// 编程语言选择器（不是界面语言选择器；界面语言在设置对话框里）
import React from "react"
import { useI18n } from "../../contexts/i18n"

interface LanguageSelectorProps {
  currentLanguage: string
  setLanguage: (language: string) => void
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLanguage,
  setLanguage
}) => {
  const { t } = useI18n()

  const handleLanguageChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newLanguage = e.target.value
    
    try {
      // 编程语言偏好写入配置（不改变界面语言）
      await window.electronAPI.updateConfig({ language: newLanguage })
      
      // 同步全局变量，供主进程侧调用点读取
      window.__LANGUAGE__ = newLanguage
      
      // 更新 React 状态
      setLanguage(newLanguage)
      
      console.log(`编程语言已切换为 ${newLanguage}`);
    } catch (error) {
      console.error("更新编程语言失败：", error)
    }
  }

  return (
    <div className="mb-3 px-2 space-y-1">
      <div className="flex items-center justify-between text-[13px] font-medium text-white/90">
        <span>{t("ui.common.programmingLanguage")}</span>
        <select
          value={currentLanguage}
          onChange={handleLanguageChange}
          aria-label={t("ui.common.programmingLanguage")}
          className="bg-black/80 text-white/90 rounded px-2 py-1 text-sm outline-none border border-white/10 focus:border-white/20"
          style={{ WebkitAppearance: 'menulist' }}
        >
          <option value="python" className="bg-black text-white">Python</option>
          <option value="javascript" className="bg-black text-white">JavaScript</option>
          <option value="java" className="bg-black text-white">Java</option>
          <option value="golang" className="bg-black text-white">Go</option>
          <option value="cpp" className="bg-black text-white">C++</option>
          <option value="swift" className="bg-black text-white">Swift</option>
          <option value="kotlin" className="bg-black text-white">Kotlin</option>
          <option value="ruby" className="bg-black text-white">Ruby</option>
          <option value="sql" className="bg-black text-white">SQL</option>
          <option value="r" className="bg-black text-white">R</option>
          <option value="csharp" className="bg-black text-white">C#</option>
        </select>
      </div>
    </div>
  )
}
