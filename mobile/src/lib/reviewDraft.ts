import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ReviewDraft } from '@/types/recipe'

const KEY = 'yourcookmate_review'
const RESET_ADD_FORM_KEY = 'yourcookmate_reset_add_form'

export async function saveReviewDraft(draft: ReviewDraft): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(draft))
}

export async function loadReviewDraft(): Promise<ReviewDraft | null> {
  const raw = await AsyncStorage.getItem(KEY)
  if (!raw) return null
  return JSON.parse(raw) as ReviewDraft
}

export async function clearReviewDraft(): Promise<void> {
  await AsyncStorage.removeItem(KEY)
}

/** Call after a recipe is saved — Add tab clears on next focus. */
export async function markAddFormForReset(): Promise<void> {
  await AsyncStorage.setItem(RESET_ADD_FORM_KEY, '1')
}

export async function consumeAddFormReset(): Promise<boolean> {
  const flag = await AsyncStorage.getItem(RESET_ADD_FORM_KEY)
  if (!flag) return false
  await AsyncStorage.removeItem(RESET_ADD_FORM_KEY)
  return true
}
