<div align="center">

# 🚀 AI Data Workspace

<p>
  <img src="https://img.shields.io/badge/Docker-Enabled-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/FastAPI-Modern-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Redis-Message_Queue-DC382D?style=for-the-badge&logo=redis&logoColor=white" />
  <img src="https://img.shields.io/badge/AI-Groq_Llama_3-000000?style=for-the-badge" />
</p>

<p>
An <b>enterprise-grade, containerized Data Engineering Sandbox</b> that enables users to securely upload datasets, perform autonomous AI-powered data cleaning, execute custom Pandas code in an isolated Docker sandbox, and generate interactive visualizations.
</p>

<p>

🎥 **Demo:** *Replace the placeholder below with your project GIF or screen recording.*

```text
assets/demo.mp4
```

</p>

</div>

---

# ✨ Features

- 📂 Secure CSV & Excel file uploads
- 🤖 AI-powered **Magic Clean** using **Llama-3 (Groq API)**
- 🐳 Docker-based isolated Python execution sandbox
- 🔒 Protection against Remote Code Execution (RCE)
- ⚡ Fast asynchronous processing with Redis + RQ
- 📊 Interactive Plotly visualizations
- 📥 Export cleaned datasets to CSV or Excel
- 🌙 Modern responsive dark-mode interface
- 📁 Multi-session workspace support

---

# 🧠 Architecture & Security

This application follows a **highly decoupled, secure, and scalable architecture** designed specifically for handling user-generated Python code safely.

### 🔹 Stateless FastAPI Backend

- Dynamic session management using serialized `.pkl` workspaces
- Independent isolated user sessions
- RESTful high-performance APIs

---

### 🔹 Asynchronous Task Queue

Heavy dataframe operations are never executed on the API server.

Instead they are processed using:

- Redis
- RQ (Redis Queue)
- Dedicated Worker Containers

This keeps the React UI responsive even for very large datasets.

---

### 🔹 Docker Execution Sandbox (RCE Prevention)

Every user-generated Python script is executed inside a disposable Linux Docker container.

This provides:

- ✅ Host machine isolation
- ✅ Restricted filesystem access
- ✅ Safe execution of AI-generated code
- ✅ Protection against malicious Python scripts

---

### 🔹 Autonomous AI Cleaning Agent

Powered by:

- **Groq API**
- **Llama-3**

The backend profiles uploaded datasets by inspecting:

- Missing values
- Data types
- Duplicate rows
- Column statistics

The LLM then generates optimized Pandas cleaning scripts under strict prompt engineering and JSON constraints before presenting them to the user.

---

### 🔹 Optimized React Rendering

Frontend performance is optimized using:

- React.memo
- Localized state management
- Minimal component re-rendering

Allowing smooth manipulation of large Excel and CSV datasets.

---

# 💻 Tech Stack

## 🎨 Frontend

| Technology | Purpose |
|------------|----------|
| React (Vite) | Frontend Framework |
| Tailwind CSS | Responsive UI |
| Plotly.js | Interactive Charts |
| React Hooks | State Management |

---

## ⚙️ Backend

| Technology | Purpose |
|------------|----------|
| Python 3.11 | Backend Runtime |
| FastAPI | REST APIs |
| Pandas | Data Processing |
| OpenPyXL | Excel Support |

---

## ☁️ Infrastructure

| Technology | Purpose |
|------------|----------|
| Docker | Containerization |
| Docker Compose | Multi-service Deployment |
| Redis | Message Queue |
| RQ | Background Workers |

---

# 📖 Core Workflows

## 📂 Data Ingestion

- Upload `.csv` or `.xlsx`
- Secure session creation
- Automatic dataframe loading

---

## ✨ Magic Clean

Click the **Copilot** button.

The backend:

- Profiles the dataset
- Detects null values
- Finds duplicates
- Inspects datatypes
- Generates optimized Pandas cleaning code

---

## 🧪 Query Sandbox

Write raw Python/Pandas code such as:

```python
df["Total"] = df["Price"] * df["Quantity"]
```

The script executes securely inside the Docker sandbox.

---

## 📊 Visualization

Assign any Plotly Express chart to a variable named:

```python
fig
```

The UI automatically renders interactive downloadable charts.

---

## 📤 Export

Export processed datasets in:

- CSV
- Excel (.xlsx)

with one click.

---

# 🐳 Running Locally

## 1️⃣ Clone Repository

```bash
git clone https://github.com/JaaniCoder/ai-data-workspace.git

cd ai-data-workspace
```

---

## 2️⃣ Configure Environment Variables

Create:

```
back/.env
```

Add:

```env
GROQ_API_KEY=your_groq_api_key_here
```

---

## 3️⃣ Start the Complete Stack

```bash
docker compose up --build -d
```

This launches:

- React Frontend
- FastAPI Backend
- Redis
- RQ Worker
- Docker Sandbox

---

## 4️⃣ Open Application

```
http://localhost:5173
```

---

# 📁 Project Highlights

✅ Enterprise Architecture

✅ AI-powered Data Cleaning

✅ Docker Sandbox Execution

✅ Redis Background Workers

✅ Interactive Plotly Charts

✅ Secure Multi-session Workspace

✅ One-click Dataset Export

---

# 🎯 Future Improvements

- Authentication
- User Dashboard
- Dataset Version History
- SQL Query Support
- AI Chart Recommendations
- Cloud Storage Integration
- Multi-user Collaboration

---

<div align="center">

## ⭐ If you found this project helpful, consider giving it a Star!

Designed & Developed with ❤️ by **JaaniCoder**

</div>
