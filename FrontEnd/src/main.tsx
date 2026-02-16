import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CardDeck from "./CardDeck/CardDeck";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CardDeck />
  </StrictMode>
)
