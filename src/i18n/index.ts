import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { useSettingsStore } from "@/stores";
import { enUS } from "./resources/en-US";
import { zhCN } from "./resources/zh-CN";

const initialLocale = useSettingsStore.getState().locale;

void i18n.use(initReactI18next).init({
  lng: initialLocale,
  fallbackLng: "zh-CN",
  interpolation: {
    escapeValue: false,
  },
  resources: {
    "zh-CN": {
      translation: zhCN,
    },
    "en-US": {
      translation: enUS,
    },
  },
});

export default i18n;

