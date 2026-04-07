import './App.css'
import { useState } from 'react'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import ApiKeySetup from "@/components/ApiKeySetup.jsx"
import { getApiKey } from '@/api/claude'
import { AceProvider } from '@/context/AceContext'

function App() {
  const [hasKey, setHasKey] = useState(() => !!getApiKey());

  if (!hasKey) {
    return <ApiKeySetup onSaved={() => setHasKey(true)} />;
  }

  return (
    <AceProvider>
      <Pages />
      <Toaster />
    </AceProvider>
  );
}

export default App
