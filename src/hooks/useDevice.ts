import { useState, useEffect } from 'react'

export interface DeviceInfo {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isTouch: boolean
  width: number
}

function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouch: false,
      width: 1200,
    }
  }

  const width = window.innerWidth
  const isTouch =
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
    (typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || (navigator as { msMaxTouchPoints?: number }).msMaxTouchPoints! > 0))

  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    isTouch: Boolean(isTouch),
    width,
  }
}

/**
 * Reactive hook that detects device viewport category (mobile, tablet, desktop) and touch capabilities.
 * Efficiently debounced using requestAnimationFrame.
 */
export function useDevice(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(getDeviceInfo)

  useEffect(() => {
    let animationFrameId: number | null = null

    const handleResize = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
      animationFrameId = requestAnimationFrame(() => {
        setDeviceInfo(getDeviceInfo())
      })
    }

    window.addEventListener('resize', handleResize, { passive: true })
    window.addEventListener('orientationchange', handleResize, { passive: true })

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])

  return deviceInfo
}
