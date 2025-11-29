const API_BASE = '/api'

export type PerformanceBand = 'elite' | 'strong' | 'stable' | 'risk'
export type ExperienceBand = 'principal' | 'senior' | 'mid' | 'junior'
export type DecisionAction = 'FIRE' | 'PROMOTE' | 'DECREASE_SALARY' | 'NO_CHANGE'

export type Suggestion = {
  action: string
  confidence: number
  reasoning: string
  suggestedSalary?: number
  suggestedSalaryFormatted?: string
  currentSalary?: number
  currentSalaryFormatted?: string
  salaryDifference?: number
  salaryDifferenceFormatted?: string
  recommended_change_percent?: number
  marketSalaryRange?: {
    min: number
    mid: number
    max: number
  }
  marketSalaryRangeFormatted?: {
    min: string
    mid: string
    max: string
  }
}

export type Employee = {
  _id: string
  ssid: string
  name: string
  role: string
  performance: PerformanceBand
  experience: ExperienceBand
  salary: number
  salaryFormatted?: string
  revenue: number
  revenueFormatted?: string
  profitFormatted?: string
  status: string
  suggestion?: Suggestion
  lastAnalyzed?: string
}

export type ActionRecord = {
  _id: string
  ssid: string
  action: string
  note?: string
  details: {
    effect: string
    previousSalary?: number
    newSalary?: number
    salary?: number
    changePercent?: number
  }
  detailsFormatted?: {
    previousSalaryFormatted?: string
    newSalaryFormatted?: string
    salaryFormatted?: string
  }
  appliedAt: string
}

export type AnalysisSummary = {
  companyBudget: number
  companyBudgetFormatted: string
  totalCurrentSalaries: number
  totalCurrentSalariesFormatted: string
  totalSuggestedSalaries: number
  totalSuggestedSalariesFormatted: string
  totalRevenue: number
  totalRevenueFormatted: string
  projectedSavings: number
  projectedSavingsFormatted: string
  projectedSavingsType: 'savings' | 'increase'
  actionCounts: Record<string, number>
}

export type AnalysisResult = {
  ssid: string
  name: string
  currentSalary: number
  currentSalaryFormatted: string
  suggestion: Suggestion & {
    salaryChangeType: 'increase' | 'decrease'
  }
}

// Fetch all employees and actions
export async function fetchEmployees(): Promise<{ employees: Employee[]; actions: ActionRecord[] }> {
  const res = await fetch(`${API_BASE}/employees`)
  if (!res.ok) throw new Error('Failed to fetch employees')
  return res.json()
}

// Fetch single employee by ssid
export async function fetchEmployee(ssid: string): Promise<{ employee: Employee; actions: ActionRecord[] }> {
  const res = await fetch(`${API_BASE}/employees/${ssid}`)
  if (!res.ok) throw new Error('Failed to fetch employee')
  return res.json()
}

// Analyze employees with budget
export async function analyzeEmployees(
  budget: number,
  ssids?: string[]
): Promise<{
  budget: number
  budgetFormatted: string
  employeesAnalyzed: number
  summary: AnalysisSummary
  results: AnalysisResult[]
}> {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ budget, ssids }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to analyze employees')
  }
  return res.json()
}

// Apply action to employee
export async function applyAction(
  ssid: string,
  action: DecisionAction,
  note?: string,
  changePercent?: number
): Promise<{
  ok: boolean
  message: string
  applied: ActionRecord
  employee: Employee
  actionDetails: {
    effect: string
    previousSalary?: number
    newSalary?: number
    changePercent?: number
  }
  actionDetailsFormatted: {
    effect: string
    previousSalaryFormatted?: string
    newSalaryFormatted?: string
    changePercent?: number
  }
}> {
  const res = await fetch(`${API_BASE}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ssid, action, note, changePercent }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to apply action')
  }
  return res.json()
}

// Get pending suggestions
export async function fetchPending(): Promise<{
  count: number
  employees: Array<{
    ssid: string
    name: string
    role: string
    salary: number
    salaryFormatted: string
    suggestion: Suggestion
    suggestionFormatted: {
      suggestedSalaryFormatted?: string
      salaryDifferenceFormatted?: string
      salaryChangeType: 'increase' | 'decrease'
    }
  }>
}> {
  const res = await fetch(`${API_BASE}/pending`)
  if (!res.ok) throw new Error('Failed to fetch pending')
  return res.json()
}

// Add or update employee
export async function saveEmployee(employee: {
  ssid: string
  name: string
  performance: PerformanceBand
  experience: ExperienceBand
  role: string
  salary: number
  revenue: number
}): Promise<{ ok: boolean; employee: Employee }> {
  const res = await fetch(`${API_BASE}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(employee),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to save employee')
  }
  return res.json()
}

// Bulk add employees
export async function bulkAddEmployees(
  employees: Array<{
    ssid: string
    name: string
    performance: PerformanceBand
    experience: ExperienceBand
    role: string
    salary: number
    revenue: number
  }>
): Promise<{ ok: boolean; results: Array<{ ssid: string; ok?: boolean; error?: string }> }> {
  const res = await fetch(`${API_BASE}/employees/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(employees),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to bulk add employees')
  }
  return res.json()
}
