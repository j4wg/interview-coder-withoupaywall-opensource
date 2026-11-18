import { createContext, useContext } from "react"

// 全局 Toast：标题与描述由调用方用 t() 翻译后传入
type ToastVariant = "neutral" | "success" | "error"

interface ToastContextType {
  showToast: (title: string, description: string, variant: ToastVariant) => void
}

export const ToastContext = createContext<ToastContextType | undefined>(
  undefined
)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast 必须在 ToastProvider 内使用")
  }
  return context
}
