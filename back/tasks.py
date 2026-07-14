import pandas as pd
import os
import io
import base64
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import plotly.express as px
import plotly.graph_objects as go
from contextlib import redirect_stdout

SESSION_DIR = "sessions"

def process_pandas_query(session_id: str, query_code: str):
    """
    This runs in a completely separate background process.
    """
    file_path = os.path.join(SESSION_DIR, f"{session_id}.pkl")

    if not os.path.exists(file_path):
        raise FileNotFoundError("Session data not found. Please upload the file again.")
    
    df = pd.read_pickle(file_path)
    safe = {'df': df, 'plt': plt, 'px': px, 'go': go}

    f = io.StringIO()
    base64_plot = None
    plotly_json = None

    try:
        plt.clf()
        plt.close('all')

        with redirect_stdout(f):
            exec(query_code, safe)

        df_modified = safe.get('df')

        if not isinstance(df_modified, pd.DataFrame):
            raise ValueError("Query did not result in a valid Pandas DataFrame.")
        
        df_modified.to_pickle(file_path)
        console_output = f.getvalue()

        if 'fig' in safe and hasattr(safe['fig'], 'to_json'):
            plotly_json = safe['fig'].to_json()

        elif plt.get_fignums():
            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight')
            buf.seek(0)
            base64_plot = base64.b64encode(buf.read()).decode('utf-8')
            plt.clf()
            plt.close('all')

        return {
            "status" : "Success",
            "console_output" : console_output,
            "base64_plot" : base64_plot,
            "plotly_json" : plotly_json
            }
    
    except Exception as e:
        crash_log = f.getvalue() + f"\n\nERROR: {type(e).__name__}: {str(e)}"
        return {"status": "Error", "console_output": crash_log, "base64_plot": None, "plotly_json": None}