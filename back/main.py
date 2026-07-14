import os
import io
import json
import uuid
import csv
import datetime
import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from redis import Redis
from rq import Queue
import httpx
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

redis_conn = Redis(host='redis', port=6379)
task_queue = Queue('default', connection=redis_conn)

SESSION_DIR = "sessions"
os.makedirs(SESSION_DIR, exist_ok=True)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = os.getenv("GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

SYSTEM_INSTRUCTION = (
    "You are an expert Data Engineer and Pandas Python assistant. "
    "The user is working with a DataFrame named 'df' with the following columns: {columns_list}. "
    "Your task is to provide the exact Pandas code to solve their request. "
    "CRITICAL PANDAS RULES: "
    "1. When assigning an aggregated value (like size, sum, mean) to a new column, you MUST use `.transform()`. Example: `df.groupby('Col')['Col'].transform('size')`. NEVER assign `.groupby().size()` directly to a column to avoid index mismatch errors. "
    "2. When combining text columns, use `.fillna('')` to prevent NaN values from corrupting the string concatenation. "
    "3. Ensure the code modifies 'df' in place or assigns the result back to 'df' so the user can see the changes. "
    "You MUST respond ONLY in valid JSON format with exactly two keys: "
    "1. 'explanation': A brief, helpful text explanation of what the code does. "
    "2. 'code': The raw, executable Pandas python code snippet. Do NOT include markdown formatting (like ```python) in this field."
)

def df_to_response(df: pd.DataFrame):
    safe_df = df.copy()
    for col in safe_df.select_dtypes(include=['datetime', 'datetime64[ns]', 'datetimetz', '<M8[ns]', 'timedelta64']).columns:
        safe_df[col] = safe_df[col].astype(str)
    for col in safe_df.select_dtypes(include=['object']).columns:
        safe_df[col] = safe_df[col].apply(
            lambda x: str(x) if isinstance(x, (datetime.datetime, datetime.date, pd.Timestamp)) else x
        )
    safe_df = safe_df.astype(object).where(pd.notna(safe_df), None)
    return {"columns": safe_df.columns.tolist(), "data": safe_df.to_dict(orient="records")}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    session_id = str(uuid.uuid4())
    file_path = os.path.join(SESSION_DIR, f"{session_id}.pkl")
    try:
        magic_bytes = file.file.read(2)
        file.file.seek(0)
        if magic_bytes == b'PK' or file.filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(file.file)
        elif file.filename.endswith('.csv'):
            try:
                df = pd.read_csv(file.file, on_bad_lines='skip')
            except Exception:
                try:
                    file.file.seek(0)
                    df = pd.read_csv(file.file, encoding='latin1', on_bad_lines='skip')
                except Exception:
                    file.file.seek(0)
                    df = pd.read_csv(file.file, encoding='latin1', on_bad_lines='skip', engine='python', quoting=csv.QUOTE_NONE)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type.")
            
        df.to_pickle(file_path)
        return JSONResponse(content={"message": "File uploaded successfully.", "session_id": session_id, "data": df_to_response(df)})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload Error: {str(e)}")

from tasks import process_pandas_query

@app.post("/execute_query")
async def execute_query(session_id: str = Form(...), query_code: str = Form(...)):
    if not session_id: raise HTTPException(status_code=400, detail="Missing session ID.")
    job = task_queue.enqueue(process_pandas_query, session_id, query_code)
    return JSONResponse(content={"message": "Task queued.", "job_id": job.id})

@app.get("/task_status/{job_id}")
async def get_task_status(job_id: str, session_id: str):
    job = task_queue.fetch_job(job_id)
    if not job: raise HTTPException(status_code=404, detail="Job not found.")
    
    if job.is_finished:
        file_path = os.path.join(SESSION_DIR, f"{session_id}.pkl")
        df = pd.read_pickle(file_path)

        job_result = job.result if isinstance(job.result, dict) else {}
        console_out = job_result.get("console_output", "")
        base64_plot = job_result.get("base64_plot", None)
        plotly_json = job_result.get("plotly_json", None)

        return {
            "status": "finished",
            "data": df_to_response(df),
            "console_output": console_out,
            "base64_plot": base64_plot,
            "plotly_json": plotly_json
            }
    elif job.is_failed:
        return {"status": "failed", "detail": str(job.exc_info)}
    else:
        return {"status": "processing"}

@app.post("/explain_query")
async def explain_query(session_id: str = Form(...), natural_language_query: str = Form(...)):
    """Uses Groq to generate a JSON response with code and explanation, contextually aware of the user's data."""
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured.")

    file_path = os.path.join(SESSION_DIR, f"{session_id}.pkl")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail="Session data not found. Please upload again.")
        
    df = pd.read_pickle(file_path)
    column_list = df.columns.tolist()

    system_prompt_content = SYSTEM_INSTRUCTION.format(columns_list=json.dumps(column_list))
    
    payload = {
        "model": GROQ_MODEL,
        "messages": [
            { "role": "system", "content": system_prompt_content },
            { "role": "user", "content": natural_language_query }
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"}
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                GROQ_API_URL,
                headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {GROQ_API_KEY}'},
                json=payload
            )
            response.raise_for_status() 
            result = response.json()
            llm_text = result['choices'][0]['message']['content']
            
            try:
                llm_data = json.loads(llm_text)
                explanation = llm_data.get("explanation", "Here is the explanation.")
                code = llm_data.get("code", "")
            except Exception:
                explanation = llm_text
                code = ""
            
            return JSONResponse(content={"explanation": explanation, "code": code})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM API Error: {str(e)}")
    
@app.get("/export/{session_id}")
async def export_data(session_id: str, fmt: str = 'csv'):
    """Generates a downloadable CSV or Excel file directly from the Pandas state."""
    file_path = os.path.join(SESSION_DIR, f"{session_id}.pkl")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Session data not found")
    
    df = pd.read_pickle(file_path)
    stream = io.BytesIO()

    if fmt == 'excel':
        df.to_excel(stream, index=False, engine='openpyxl')
        media_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        filename = 'Worksheet_Export.xlsx'
    else:
        df.to_csv(stream, index=False)
        media_type = 'text/csv'
        filename = 'Workspace_Export.csv'

    stream.seek(0)
    return Response(
        content=stream.read(),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/load_session/{session_id}")
async def load_session(session_id: str):
    """Restores the workspace if the user refreshes the browser."""
    file_path = os.path.join(SESSION_DIR, f"{session_id}.pkl")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Session expired or not found.")
    df = pd.read_pickle(file_path)
    return {"status": "success", "session_id": session_id, "data": df_to_response(df)}

@app.post("/auto_clean_recipe")
async def auto_clean_recipe(session_id: str = Form(...)):
    """Acts as an autonomous agent to analyze the dataset and write cleaning code."""
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured.")

    file_path = os.path.join(SESSION_DIR, f"{session_id}.pkl")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail="Session data not found.")
        
    df = pd.read_pickle(file_path)

    buffer = io.StringIO()
    df.info(buf=buffer)
    info_str = buffer.getvalue()
    
    missing_data = df.isnull().sum()
    missing_str = missing_data[missing_data > 0].to_string()
    if not missing_str.strip():
        missing_str = "No missing values detected."

    system_prompt = (
        "You are an expert Data Engineer. "
        "You MUST respond ONLY in valid JSON format with exactly two keys: "
        "1. 'explanation': A brief explanation of what issues were found and how you will clean them. "
        "2. 'code': The raw, executable Pandas python code snippet. Do NOT include markdown."
    )
    user_prompt = (
        f"Analyze this dataset profile:\n{info_str}\n\n"
        f"Missing Values:\n{missing_str}\n\n"
        "Write a Pandas script to clean this data in-place. "
        "Drop exact duplicates, fill missing numeric values with the median, and fill missing text values with 'Unknown'. "
        "Ensure the final cleaned dataframe is assigned back to 'df'."
    )
    
    payload = {
        "model": GROQ_MODEL,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_prompt }
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"}
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                GROQ_API_URL, headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {GROQ_API_KEY}'}, json=payload
            )
            response.raise_for_status() 
            llm_text = response.json()['choices'][0]['message']['content']
            try:
                llm_data = json.loads(llm_text)
                return JSONResponse(content={"explanation": llm_data.get("explanation", ""), "code": llm_data.get("code", "")})
            except Exception:
                return JSONResponse(content={"explanation": "Failed to parse JSON.", "code": ""})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))