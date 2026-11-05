import * as SecureStore from "expo-secure-store";

export const loadConnection = () => SecureStore.getItemAsync("connection");
export const saveConnection = (value: string) =>
  SecureStore.setItemAsync("connection", value);
export const clearConnection = () =>
  SecureStore.deleteItemAsync("connection");
