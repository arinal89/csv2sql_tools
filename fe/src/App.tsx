import { Router, Route } from '@solidjs/router';
import type { Component } from 'solid-js';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import CSVToSQL from './components/CSVToSQL';
import NormalizeCSV from './components/NormalizeCSV';
import DataTypeCSV from './components/DataTypeCSV';
import NullHandling from './components/NullHandling';
import SQLSplitter from './components/SQLSplitter';

const App: Component = () => {
  return (
    <ThemeProvider>
      <Router>
        <Route path="/" component={() => <Layout><CSVToSQL /></Layout>} />
        <Route path="/csv-to-sql" component={() => <Layout><CSVToSQL /></Layout>} />
        <Route path="/normalize-csv" component={() => <Layout><NormalizeCSV /></Layout>} />
        <Route path="/data-type-csv" component={() => <Layout><DataTypeCSV /></Layout>} />
        <Route path="/null-handling" component={() => <Layout><NullHandling /></Layout>} />
        <Route path="/sql-splitter" component={() => <Layout><SQLSplitter /></Layout>} />
      </Router>
    </ThemeProvider>
  );
};

export default App;
