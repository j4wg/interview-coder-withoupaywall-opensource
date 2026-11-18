import React from "react"
// 截图队列：最多展示前 5 张缩略图
import ScreenshotItem from "./ScreenshotItem"

interface Screenshot {
  path: string
  preview: string
}

interface ScreenshotQueueProps {
  isLoading: boolean
  screenshots: Screenshot[]
  onDeleteScreenshot: (index: number) => void
}
const ScreenshotQueue: React.FC<ScreenshotQueueProps> = ({
  isLoading,
  screenshots,
  onDeleteScreenshot
}) => {
  if (screenshots.length === 0) {
    return <></>
  }

  const displayScreenshots = screenshots.slice(0, 5)

  return (
    <div className="flex gap-4">
      {displayScreenshots.map((screenshot, index) => (
        <ScreenshotItem
          key={screenshot.path}
          isLoading={isLoading}
          screenshot={screenshot}
          index={index}
          onDelete={onDeleteScreenshot}
        />
      ))}
    </div>
  )
}

export default ScreenshotQueue
