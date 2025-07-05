# CSV Tools Frontend

A modern web application built with SolidJS and Tailwind CSS for processing CSV files. This application provides comprehensive tools for CSV manipulation, data type analysis, and SQL conversion.

## Features

- **CSV to SQL Converter**: Convert CSV files to SQL CREATE TABLE and INSERT statements with automatic data type detection
- **Normalize CSV**: Clean and normalize CSV data by removing duplicates, trimming whitespace, and standardizing headers
- **Data Type Analysis**: Automatically detect and convert data types in CSV columns with confidence scoring
- **NULL Handling**: Detect and handle NULL values in CSV data with customizable strategies
- **SQL Splitter**: Split large SQL files into smaller, manageable chunks

## Technical Stack

- **Frontend**: SolidJS with TypeScript
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **CSV Processing**: PapaCSV library
- **Icons**: Lucide Icons
- **File Processing**: Client-side only (no backend required)

## Installation

```bash
npm install --legacy-peer-deps
```

## Usage

```bash
# Development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Available Scripts

### `npm run dev`

Runs the app in development mode. Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

### `npm run build`

Builds the app for production to the `dist` folder. The build is minified and optimized for best performance.

### `npm run preview`

Serves the production build locally for testing.

## Features Overview

### CSV to SQL Converter
- Upload CSV files and automatically generate SQL CREATE TABLE statements
- Intelligent data type detection (INTEGER, VARCHAR, DATE, etc.)
- Generate INSERT statements for data migration
- Preview data before conversion
- Download generated SQL files

### Normalize CSV
- Remove duplicate rows
- Trim whitespace from cells
- Standardize column headers
- Merge multiple CSV files
- Handle inconsistent data formats

### Data Type Analysis
- Automatic detection of column data types
- Confidence scoring for detected types
- Manual type override capabilities
- Support for various data types (TEXT, INTEGER, BOOLEAN, DATE, etc.)
- Data validation and warnings

### NULL Handling
- Detect various NULL representations (empty, 'null', 'NA', etc.)
- Statistics on NULL values per column
- Configurable handling strategies (replace, remove, keep)
- Row-level NULL handling options

### SQL Splitter
- Split large SQL files by number of statements
- Split by number of lines
- Split by file size
- Preserve SQL statement integrity
- Batch download of split files

## Project Structure

```
src/
├── components/          # React components
│   ├── Sidebar.tsx     # Navigation sidebar
│   ├── CSVToSQL.tsx    # CSV to SQL converter
│   ├── NormalizeCSV.tsx # CSV normalization
│   ├── DataTypeCSV.tsx # Data type analysis
│   ├── NullHandling.tsx # NULL value handling
│   └── SQLSplitter.tsx # SQL file splitter
├── App.tsx             # Main application component
├── index.tsx           # Application entry point
└── index.css           # Global styles with Tailwind
```

## Design Principles

- **Client-side Processing**: All file operations happen in the browser
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Clean, intuitive interface with Tailwind CSS
- **Error Handling**: Comprehensive error messages and validation
- **Accessibility**: Keyboard navigation and screen reader support
- **Performance**: Efficient processing of large CSV files

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Deployment

You can deploy this application to any static hosting service like Netlify, Vercel, or GitHub Pages.

Learn more about deploying your application with the [Vite documentation](https://vitejs.dev/guide/static-deploy.html).
