# Changelog

All notable changes to the CSV Tools Frontend project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Version management system
- Automated versioning scripts
- Changelog documentation

## [1.0.0] - 2025-01-05

### Added
- **CSV to SQL Converter**
  - Convert CSV files to SQL CREATE TABLE and INSERT statements
  - Configurable output file naming
  - Batch size control for INSERT statements
  - Auto-detection of data types
  - Download generated SQL files

- **Normalize CSV**
  - Clean and normalize CSV data
  - Multiple file upload support with drag-and-drop
  - Remove duplicate rows
  - Trim whitespace from cells
  - Standardize column headers (lowercase, underscores)
  - File preview functionality
  - Column mapping preview for multi-file merging
  - Visual indicators for column matching

- **Data Type Analysis**
  - Automatically detect and analyze data types in CSV columns
  - Convert between different data types
  - Handle mixed data types in columns
  - Statistical analysis of numeric columns

- **NULL Handling**
  - Detect and handle NULL values in CSV data
  - Convert empty strings to NULL
  - Replace NULL values with defaults
  - Statistical analysis of NULL distribution

- **SQL Splitter**
  - Split large SQL files into smaller chunks
  - Configurable chunk size
  - Preserve SQL statement integrity
  - Batch processing support

- **User Interface**
  - Modern responsive design with Tailwind CSS
  - Sidebar navigation with tool selection
  - Drag-and-drop file upload
  - Real-time file validation
  - Error handling and user feedback
  - Progress indicators for long operations

- **Technical Features**
  - Built with SolidJS and TypeScript
  - Client-side processing (no backend required)
  - Vite build system for fast development
  - Comprehensive error handling
  - Cross-browser compatibility

### Technical Details
- **Framework**: SolidJS with TypeScript
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **CSV Processing**: PapaCSV library
- **Icons**: Lucide Icons
- **File Size**: Client-side processing up to 10MB per file

[Unreleased]: https://github.com/arinal89/csv_tools/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/arinal89/csv_tools/releases/tag/v1.0.0
