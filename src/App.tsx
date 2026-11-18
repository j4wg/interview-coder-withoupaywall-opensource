import SubscribedApp from "./_pages/SubscribedApp"
import { UpdateNotification } from "./components/UpdateNotification"
import {
  QueryClient,
  QueryClientProvider
} from "@tanstack/react-query"
import { useEffect, useRef, useState, useCallback } from "react"
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport
} from "./components/ui/toast"
import { ToastContext } from "./contexts/toast"
import { WelcomeScreen } from "./components/WelcomeScreen"
import { SettingsDialog } from "./components/Settings/SettingsDialog"
import { useI18n } from "./contexts/i18n"

// React Query 客户端：本地桌面应用，只缓存内存态数据，不做窗口聚焦重取
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: Infinity,
      retry: 1,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 1
    }
  }
})

// 根组件：提供 QueryClient、Toast 与全局设置对话框
function App() {
  const { t, ready } = useI18n()
  // 事件回调里要取"当前语言"的文案：用 ref 持有最新 t，避免把 t 放进初始化 effect 的依赖
  // （否则切语言会重跑初始化、整页闪一下）
  const tRef = useRef(t)
  tRef.current = t
  const [toastState, setToastState] = useState({
    open: false,
    title: "",
    description: "",
    variant: "neutral" as "neutral" | "success" | "error"
  })
  const [credits, setCredits] = useState<number>(999) // 本版本不限额
  const [currentLanguage, setCurrentLanguage] = useState<string>("java")
  const [isInitialized, setIsInitialized] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  // 模型选择在设置对话框内分别配置（提取 / 解答 / 调试），这里不再持有单一模型

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // 额度固定为"不限"（开源版不扣额度）
  const updateCredits = useCallback(() => {
    setCredits(999)
    window.__CREDITS__ = 999
  }, [])

  // 编程语言（与界面语言无关）：同时写全局变量，供主进程侧调用点读取
  const updateLanguage = useCallback((newLanguage: string) => {
    setCurrentLanguage(newLanguage)
    window.__LANGUAGE__ = newLanguage
  }, [])

  // 标记初始化完成，之后才渲染主界面
  const markInitialized = useCallback(() => {
    setIsInitialized(true)
    window.__IS_INITIALIZED__ = true
  }, [])

  // 统一 Toast 出口：标题与描述由调用方传入（已翻译）
  const showToast = useCallback(
    (
      title: string,
      description: string,
      variant: "neutral" | "success" | "error"
    ) => {
      setToastState({
        open: true,
        title,
        description,
        variant
      })
    },
    []
  )

  // 检查 API Key；缺失时延迟弹出设置对话框，避免首屏就打断用户
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const hasKey = await window.electronAPI.checkApiKey()
        setHasApiKey(hasKey)
        
        // If no API key is found, show the settings dialog after a short delay
        if (!hasKey) {
          setTimeout(() => {
            setIsSettingsOpen(true)
          }, 1000)
        }
      } catch (error) {
        console.error("检查 API Key 失败：", error)
      }
    }
    
    if (isInitialized) {
      checkApiKey()
    }
  }, [isInitialized])

  // 初始化下拉控件：主进程侧渲染时序不稳，这里兜底解除 disabled
  useEffect(() => {
    if (isInitialized) {
      // 稍作延迟后处理所有下拉控件（含原生 select 与自定义下拉）
      const timer = setTimeout(() => {
        // 同时覆盖原生 select 与自定义下拉
        const selectElements = document.querySelectorAll('select');
        const customDropdowns = document.querySelectorAll('.dropdown-trigger, [role="combobox"], button:has(.dropdown)');
        
        // 启用原生 select
        selectElements.forEach(dropdown => {
          dropdown.disabled = false;
        });
        
        // 移除自定义下拉的 disabled 属性
        customDropdowns.forEach(dropdown => {
          if (dropdown instanceof HTMLElement) {
            dropdown.removeAttribute('disabled');
            dropdown.setAttribute('aria-disabled', 'false');
          }
        });
        
        console.log(`已启用 ${selectElements.length} 个原生下拉与 ${customDropdowns.length} 个自定义下拉`);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isInitialized]);

  // 监听主进程的"打开设置"请求（托盘/快捷键）
  useEffect(() => {
    const unsubscribeSettings = window.electronAPI.onShowSettings(() => {
      console.log("收到打开设置对话框的请求");
      setIsSettingsOpen(true);
    });
    
    return () => {
      unsubscribeSettings();
    };
  }, []);

  // 初始化应用状态：额度、编程语言、初始化标记
  useEffect(() => {
    // Load config and set values
    const initializeApp = async () => {
      try {
        // 额度不限额
        updateCredits()

        // 读取配置中的编程语言（默认 java，与界面语言互不影响）
        const config = await window.electronAPI.getConfig()

        if (config && config.language) {
          updateLanguage(config.language)
        } else {
          updateLanguage("java")
        }

        // 模型选择在设置对话框内维护，存放于 config 的 extractionModel / solutionModel / debuggingModel

        markInitialized()
      } catch (error) {
        console.error("初始化应用失败：", error)
        // 读配置失败时按默认值继续，保证界面可用
        updateLanguage("java")
        markInitialized()
      }
    }
    
    initializeApp()

    // 处理主进程事件
    const onApiKeyInvalid = () => {
      showToast(
        tRef.current("ui.app.toast.apiKeyInvalid.title"),
        tRef.current("ui.app.toast.apiKeyInvalid.description"),
        "error"
      )
      setApiKeyDialogOpen(true)
    }

    // 订阅 API Key 失效事件
    window.electronAPI.onApiKeyInvalid(onApiKeyInvalid)

    // 解答成功的空处理：本版本不扣额度
    const unsubscribeSolutionSuccess = window.electronAPI.onSolutionSuccess(
      () => {
        console.log("解答生成成功；本版本不扣额度")
      }
    )

    // 卸载时清理监听并复位初始化标记
    return () => {
      window.electronAPI.removeListener("API_KEY_INVALID", onApiKeyInvalid)
      unsubscribeSolutionSuccess()
      window.__IS_INITIALIZED__ = false
      setIsInitialized(false)
    }
  }, [updateCredits, updateLanguage, markInitialized, showToast])

  // 设置对话框开关
  const handleOpenSettings = useCallback(() => {
    console.log('正在打开设置对话框');
    setIsSettingsOpen(true);
  }, []);
  
  const handleCloseSettings = useCallback((open: boolean) => {
    console.log('设置对话框开关状态变更：', open);
    setIsSettingsOpen(open);
  }, []);

  // 保存 API Key：成功提示并短暂延迟后重载，让主进程用新 Key 重新初始化
  const handleApiKeySave = useCallback(
    async (apiKey: string) => {
      try {
        await window.electronAPI.updateConfig({ apiKey })
        setHasApiKey(true)
        showToast(
          t("ui.common.success"),
          t("ui.app.toast.apiKeySaved"),
          "success"
        )

        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } catch (error) {
        console.error("保存 API Key 失败：", error)
        showToast(
          t("ui.common.error"),
          t("ui.app.toast.apiKeySaveFailed"),
          "error"
        )
      }
    },
    [showToast, t]
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ToastContext.Provider value={{ showToast }}>
          <div className="relative">
            {isInitialized ? (
              hasApiKey ? (
                <SubscribedApp
                  credits={credits}
                  currentLanguage={currentLanguage}
                  setLanguage={updateLanguage}
                />
              ) : (
                <WelcomeScreen onOpenSettings={handleOpenSettings} />
              )
            ) : (
              <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin"></div>
                  {/* 界面语言确定前不出文案，避免首帧语言闪烁 */}
                  {ready && (
                    <p className="text-white/60 text-sm">
                      {t("ui.app.initializing")}
                    </p>
                  )}
                </div>
              </div>
            )}
            <UpdateNotification />
          </div>
          
          {/* 设置对话框 */}
          <SettingsDialog 
            open={isSettingsOpen} 
            onOpenChange={handleCloseSettings} 
          />
          
          <Toast
            open={toastState.open}
            onOpenChange={(open) =>
              setToastState((prev) => ({ ...prev, open }))
            }
            variant={toastState.variant}
            duration={1500}
          >
            <ToastTitle>{toastState.title}</ToastTitle>
            <ToastDescription>{toastState.description}</ToastDescription>
          </Toast>
          <ToastViewport />
        </ToastContext.Provider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App