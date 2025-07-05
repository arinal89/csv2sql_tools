from flask import Blueprint, request, jsonify
import pandas as pd
import json

main_bp = Blueprint('main', __name__)

@main_bp.route('/api/process-csv', methods=['POST'])
def process_csv():
    """
    Process CSV data received from frontend
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    try:
        # Read the CSV file
        df = pd.read_csv(file)
        
        # Get basic stats
        stats = {
            "rowCount": len(df),
            "columnCount": len(df.columns),
            "columns": list(df.columns),
            "previewData": json.loads(df.head(5).to_json(orient='records'))
        }
        
        return jsonify(stats), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@main_bp.route('/api/normalize-csv', methods=['POST'])
def normalize_csv():
    """
    Normalize CSV data
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    try:
        # Read the CSV file
        df = pd.read_csv(file)
        
        # Normalize the data (here we're applying basic normalization)
        # For numeric columns, apply min-max scaling
        numeric_columns = df.select_dtypes(include=['number']).columns
        
        for col in numeric_columns:
            min_val = df[col].min()
            max_val = df[col].max()
            if max_val > min_val:  # Avoid division by zero
                df[col] = (df[col] - min_val) / (max_val - min_val)
        
        # Convert to JSON for response
        normalized_data = json.loads(df.to_json(orient='records'))
        
        result = {
            "normalizedData": normalized_data,
            "rowCount": len(df)
        }
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@main_bp.route('/api/handle-nulls', methods=['POST'])
def handle_nulls():
    """
    Handle null values in CSV data
    """
    data = request.json
    
    if not data or 'csvData' not in data or 'strategy' not in data:
        return jsonify({"error": "Invalid request format"}), 400
    
    try:
        # Convert JSON data to DataFrame
        df = pd.DataFrame(data['csvData'])
        strategy = data['strategy']
        columns = data.get('columns', df.columns)
        
        for column in columns:
            if column in df.columns:
                if strategy == 'drop':
                    df = df.dropna(subset=[column])
                elif strategy == 'mean':
                    if pd.api.types.is_numeric_dtype(df[column]):
                        df[column] = df[column].fillna(df[column].mean())
                elif strategy == 'median':
                    if pd.api.types.is_numeric_dtype(df[column]):
                        df[column] = df[column].fillna(df[column].median())
                elif strategy == 'mode':
                    df[column] = df[column].fillna(df[column].mode()[0] if not df[column].mode().empty else None)
                elif strategy == 'zero':
                    df[column] = df[column].fillna(0)
                elif strategy == 'value':
                    fill_value = data.get('fillValue', '')
                    df[column] = df[column].fillna(fill_value)
        
        # Convert back to JSON for response
        result = {
            "processedData": json.loads(df.to_json(orient='records')),
            "rowCount": len(df)
        }
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@main_bp.route('/api/determine-datatypes', methods=['POST'])
def determine_datatypes():
    """
    Determine and potentially convert data types in a CSV
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    try:
        # Read the CSV file with all columns as string first
        df = pd.read_csv(file, dtype=str)
        
        # Analyze data types
        type_info = {}
        for column in df.columns:
            # Check if column can be converted to numeric
            numeric_conversion = pd.to_numeric(df[column], errors='coerce')
            null_count_before = df[column].isna().sum()
            null_count_after = numeric_conversion.isna().sum()
            
            # If we didn't introduce too many new nulls, it's probably numeric
            if null_count_after - null_count_before < len(df) * 0.1:
                # Check if integer
                if pd.Series(numeric_conversion.dropna() % 1 == 0).all():
                    type_info[column] = {
                        'detected': 'integer',
                        'nullCount': null_count_after
                    }
                else:
                    type_info[column] = {
                        'detected': 'float',
                        'nullCount': null_count_after
                    }
            else:
                # Check if datetime
                try:
                    datetime_conversion = pd.to_datetime(df[column], errors='coerce')
                    null_count_datetime = datetime_conversion.isna().sum()
                    if null_count_datetime - null_count_before < len(df) * 0.1:
                        type_info[column] = {
                            'detected': 'datetime',
                            'nullCount': null_count_datetime
                        }
                    else:
                        type_info[column] = {
                            'detected': 'string',
                            'nullCount': null_count_before
                        }
                except:
                    type_info[column] = {
                        'detected': 'string',
                        'nullCount': null_count_before
                    }
        
        result = {
            "typeInfo": type_info,
            "rowCount": len(df),
            "columnCount": len(df.columns),
            "previewData": json.loads(df.head(5).to_json(orient='records'))
        }
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@main_bp.route('/api/csv-to-sql', methods=['POST'])
def csv_to_sql():
    """
    Convert CSV data to SQL insert statements
    """
    data = request.json
    
    if not data or 'csvData' not in data or 'tableName' not in data:
        return jsonify({"error": "Invalid request format"}), 400
    
    try:
        # Convert JSON data to DataFrame
        df = pd.DataFrame(data['csvData'])
        table_name = data['tableName']
        # Get the batch size, default to 1 (individual inserts)
        batch_size = data.get('batchSize', 1)
        
        # Generate create table statement
        columns = []
        for col in df.columns:
            # Determine column type
            if pd.api.types.is_integer_dtype(df[col]):
                col_type = "INTEGER"
            elif pd.api.types.is_float_dtype(df[col]):
                col_type = "FLOAT"
            elif pd.api.types.is_datetime64_dtype(df[col]):
                col_type = "DATETIME"
            else:
                col_type = "TEXT"
                
            columns.append(f"`{col}` {col_type}")
        
        create_table = f"CREATE TABLE `{table_name}` (\n  " + ",\n  ".join(columns) + "\n);"
        
        # Generate insert statements with batching
        insert_statements = []
        total_rows = len(df)
        
        if batch_size <= 1:
            # Generate individual INSERT statements (one per row)
            for _, row in df.iterrows():
                values = []
                for val in row:
                    if pd.isna(val):
                        values.append("NULL")
                    elif isinstance(val, (int, float)):
                        values.append(str(val))
                    else:
                        # Escape single quotes in string values
                        values.append(f"'{str(val).replace('\'', '\'\'')}'" if val else "NULL")
                
                insert = f"INSERT INTO `{table_name}` ({', '.join([f'`{col}`' for col in df.columns])}) VALUES ({', '.join(values)});"
                insert_statements.append(insert)
        else:
            # Generate batched INSERT statements with multiple rows per statement
            for i in range(0, total_rows, batch_size):
                batch_df = df.iloc[i:i+batch_size]
                value_strings = []
                
                for _, row in batch_df.iterrows():
                    row_values = []
                    for val in row:
                        if pd.isna(val):
                            row_values.append("NULL")
                        elif isinstance(val, (int, float)):
                            row_values.append(str(val))
                        else:
                            # Escape single quotes in string values
                            row_values.append(f"'{str(val).replace('\'', '\'\'')}'" if val else "NULL")
                    
                    value_strings.append(f"({', '.join(row_values)})")
                
                multi_insert = f"INSERT INTO `{table_name}` ({', '.join([f'`{col}`' for col in df.columns])}) VALUES\n" + ",\n".join(value_strings) + ";"
                insert_statements.append(multi_insert)
        
        result = {
            "createTableStatement": create_table,
            "insertStatements": insert_statements,
            "rowCount": len(df),
            "columnCount": len(df.columns)
        }
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@main_bp.route('/api/sql-splitter', methods=['POST'])
def sql_splitter():
    """
    Split large SQL files into smaller chunks
    """
    data = request.json
    
    if not data or 'sqlContent' not in data:
        return jsonify({"error": "Invalid request format"}), 400
    
    try:
        sql_content = data['sqlContent']
        max_chunk_size = data.get('maxChunkSize', 1000)  # Default chunk size: 1000 lines
        
        # Split by semicolon and newline to identify statements
        statements = []
        current_statement = ""
        
        for line in sql_content.splitlines():
            current_statement += line + "\n"
            
            if ";" in line:
                statements.append(current_statement.strip())
                current_statement = ""
        
        # Add the last statement if not empty
        if current_statement.strip():
            statements.append(current_statement.strip())
        
        # Group statements into chunks
        chunks = []
        current_chunk = []
        current_chunk_size = 0
        
        for statement in statements:
            statement_size = len(statement.splitlines())
            
            if current_chunk_size + statement_size > max_chunk_size and current_chunk:
                chunks.append("\n".join(current_chunk))
                current_chunk = [statement]
                current_chunk_size = statement_size
            else:
                current_chunk.append(statement)
                current_chunk_size += statement_size
        
        # Add the last chunk if not empty
        if current_chunk:
            chunks.append("\n".join(current_chunk))
        
        result = {
            "chunks": chunks,
            "chunkCount": len(chunks),
            "originalStatementCount": len(statements)
        }
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
