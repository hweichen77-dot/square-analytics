import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface GoalStore {
  weeklyGoal: number | null
  monthlyGoal: number | null
  setWeeklyGoal: (v: number | null) => void
  setMonthlyGoal: (v: number | null) => void
}

export const useGoalStore = create<GoalStore>()(
  persist(
    set => ({
      weeklyGoal: null,
      monthlyGoal: null,
      setWeeklyGoal: v => set({ weeklyGoal: v }),
      setMonthlyGoal: v => set({ monthlyGoal: v }),
    }),
    { name: 'walleys-goals' }
  )
)
