# CSV Tools Backend

Python backend for CSV processing and transformation.

## Setup

1. Create a virtual environment (optional but recommended):
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Run the server:
   ```
   python run.py
   ```

The server will start on http://localhost:5000

## API Endpoints

- `POST /api/process-csv`: Upload and analyze a CSV file
- `POST /api/normalize-csv`: Normalize data in a CSV file
- `POST /api/handle-nulls`: Handle null values in CSV data
- `POST /api/determine-datatypes`: Analyze and detect data types in a CSV
- `POST /api/csv-to-sql`: Convert CSV data to SQL statements
- `POST /api/sql-splitter`: Split large SQL files into manageable chunks

## Integrating with Frontend

Update your frontend API calls to point to these endpoints instead of using the JavaScript functions.
