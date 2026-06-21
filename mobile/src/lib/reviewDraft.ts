import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ReviewDraft } from '@/types/recipe'

const KEY = 'yourcookmate_review'

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
