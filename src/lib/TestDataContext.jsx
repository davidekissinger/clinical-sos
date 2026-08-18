import React, { createContext, useContext, useState, useEffect } from 'react';

const TestDataContext = createContext({ showTestData: false, setShowTestData: () => {} });

export function TestDataProvider({ children }) {
  const [showTestData, setShowTestData] = useState(() => {
    try { return localStorage.getItem('csos_show_test_data') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('csos_show_test_data', String(showTestData)); } catch { /* ignore */ }
  }, [showTestData]);

  return (
    <TestDataContext.Provider value={{ showTestData, setShowTestData }}>
      {children}
    </TestDataContext.Provider>
  );
}

export function useTestData() {
  return useContext(TestDataContext);
}