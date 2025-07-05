# CSV Tools

This project provides tools for processing and transforming CSV files. It includes both a frontend and a backend, designed to work together for efficient data handling.

## Project Structure

- **`fe/`**: The frontend application built with React and TypeScript.
- **`be/`**: The backend application built with Python and Flask.

## Features

### Frontend (`fe/`)
- Upload and preview CSV files.
- Convert CSV data to SQL statements.
- Normalize CSV data.
- Handle null values in CSV files.
- Detect data types in CSV columns.
- Split large SQL files into smaller chunks.

### Backend (`be/`)
- API endpoints for processing CSV files.
- Convert CSV data to SQL statements with batch size support.
- Normalize CSV data.
- Handle null values in CSV files.
- Detect data types in CSV columns.
- Split large SQL files into smaller chunks.

## Setup

### Frontend
1. Navigate to the `fe/` directory:
   ```bash
   cd fe
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

### Backend
1. Navigate to the `be/` directory:
   ```bash
   cd be
   ```
2. Activate the virtual environment:
   ```bash
   .venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the backend server:
   ```bash
   python run.py
   ```

## Usage

1. Start both the frontend and backend servers.
2. Open the frontend application in your browser (default: `http://localhost:5173`).
3. Use the tools to upload and process CSV files.

## License

This project is licensed under the MIT License.
