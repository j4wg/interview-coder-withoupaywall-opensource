import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { I18nProvider } from "./contexts/i18n"
import "./index.css"

// I18nProvider 包在最外层：界面语言在首屏渲染前就要确定，任何页面都能拿到 useI18n()
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
)
