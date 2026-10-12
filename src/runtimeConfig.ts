import { getAppChannelConfig } from "@/appChannel"

export const appChannel = import.meta.env.VITE_APP_CHANNEL ?? "regular"
export const appChannelConfig = getAppChannelConfig(appChannel)
