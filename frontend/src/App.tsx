import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  fetchEmployees,
  analyzeEmployees,
  applyAction,
  type Employee,
  type ActionRecord,
  type AnalysisSummary,
  type DecisionAction,
} from './api'

type UIDecisionAction = 'increase' | 'decrease' | 'keep' | 'fire'

const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const factorLibrary = [
  { label: 'Location cost multiplier', detail: 'Geo-based labor premium pulled from finance COE' },
  { label: 'Automation readiness', detail: 'Can downstream workflow auto-trigger Workday comp events' },
  { label: 'Attrition probability', detail: 'Signal from talent intelligence + performance trajectory' },
  { label: 'Role criticality', detail: 'Dependency graph of in-flight projects and coverage depth' },
]

const decisionPalette: Record<UIDecisionAction, string> = {
  increase: '#2563eb',
  decrease: '#d97706',
  keep: '#15803d',
  fire: '#dc2626',
}

// Map backend actions to UI actions
const mapBackendAction = (action?: string): UIDecisionAction => {
  if (!action) return 'keep'
  switch (action.toUpperCase()) {
    case 'FIRE':
      return 'fire'
    case 'PROMOTE':
      return 'increase'
    case 'DECREASE_SALARY':
      return 'decrease'
    case 'NO_CHANGE':
    default:
      return 'keep'
  }
}

// Map UI actions to backend actions
const mapUIActionToBackend = (action: UIDecisionAction): DecisionAction => {
  switch (action) {
    case 'fire':
      return 'FIRE'
    case 'increase':
      return 'PROMOTE'
    case 'decrease':
      return 'DECREASE_SALARY'
    case 'keep':
    default:
      return 'NO_CHANGE'
  }
}

const DecisionBadge = ({ action }: { action: UIDecisionAction }) => (
  <span className="decision-badge" style={{ background: decisionPalette[action] }}>
    {action === 'fire'
      ? 'Fire'
      : action === 'increase'
        ? 'Increase Salary'
        : action === 'decrease'
          ? 'Decrease Salary'
          : 'Do Nothing'}
  </span>
)

function App() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [actions, setActions] = useState<ActionRecord[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [applyingAction, setApplyingAction] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [budget, setBudget] = useState(50000000) // 5 crore default budget
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummary | null>(null)

  // Load employees from backend
  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchEmployees()
      setEmployees(data.employees)
      setActions(data.actions)
      if (data.employees.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(data.employees[0].ssid)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees')
    } finally {
      setLoading(false)
    }
  }, [selectedEmployeeId])

  useEffect(() => {
    loadEmployees()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedEmployee = useMemo(
    () => employees.find((emp) => emp.ssid === selectedEmployeeId) ?? employees[0],
    [employees, selectedEmployeeId]
  )

  const selectedDecision = useMemo(() => {
    if (!selectedEmployee?.suggestion) {
      return {
        action: 'keep' as UIDecisionAction,
        reason: 'No analysis performed yet. Run analysis to get AI recommendations.',
        confidence: 0,
        profitability: selectedEmployee ? (selectedEmployee.revenue || 0) - (selectedEmployee.salary || 0) : 0,
        margin: selectedEmployee && selectedEmployee.revenue ? ((selectedEmployee.revenue - selectedEmployee.salary) / selectedEmployee.revenue) : 0,
      }
    }
    const suggestion = selectedEmployee.suggestion
    const profit = (selectedEmployee.revenue || 0) - (selectedEmployee.salary || 0)
    const margin = selectedEmployee.revenue ? profit / selectedEmployee.revenue : 0
    return {
      action: mapBackendAction(suggestion.action),
      reason: suggestion.reasoning || 'AI analysis complete.',
      confidence: suggestion.confidence || 0,
      profitability: profit,
      margin,
      suggestedSalary: suggestion.suggestedSalary,
      changePercent: suggestion.recommended_change_percent,
    }
  }, [selectedEmployee])

  const orgSummary = useMemo(() => {
    const totals = employees.reduce(
      (acc, emp) => {
        const salary = emp.salary || 0
        const revenue = emp.revenue || 0
        const profit = revenue - salary
        if (profit < 0) acc.atRisk += 1
        acc.totalSalary += salary
        acc.totalRevenue += revenue
        acc.netProfit += profit
        return acc
      },
      {
        atRisk: 0,
        totalSalary: 0,
        totalRevenue: 0,
        netProfit: 0,
      }
    )
    return {
      ...totals,
      margin: totals.totalRevenue === 0 ? 0 : totals.netProfit / totals.totalRevenue,
    }
  }, [employees])

  const handleAnalyze = async () => {
    try {
      setAnalyzing(true)
      setError(null)
      const result = await analyzeEmployees(budget)
      setAnalysisSummary(result.summary)
      // Reload employees to get updated suggestions
      await loadEmployees()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze employees')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleApplyAction = async (action: UIDecisionAction) => {
    if (!selectedEmployee) return
    try {
      setApplyingAction(true)
      setError(null)
      const backendAction = mapUIActionToBackend(action)
      await applyAction(
        selectedEmployee.ssid,
        backendAction,
        undefined,
        selectedDecision.changePercent
      )
      // Reload employees to get updated state
      await loadEmployees()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply action')
    } finally {
      setApplyingAction(false)
    }
  }

  const updateSelected = (employee: Employee) => {
    setSelectedEmployeeId(employee.ssid)
  }

  if (loading) {
    return (
      <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Loading employees...</h2>
          <p>Connecting to backend API</p>
        </div>
      </div>
    )
  }

  if (error && employees.length === 0) {
    return (
      <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#dc2626' }}>Error</h2>
          <p>{error}</p>
          <button className="primary" onClick={loadEmployees}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Agentic Finance Copilot</p>
          <h1>Sense profitability per employee and automate compensation moves.</h1>
          <p className="lede">
            Stream live expense, revenue, and talent signals into a reasoning agent that outputs clear actions—fire, salary decrease,
            increase, or hold—for every employee. Corporate Ops can approve with one click, and downstream HRIS automations do the rest.
          </p>
        </div>
        <div className="hero-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', color: '#64748b' }}>
              Budget:
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                style={{
                  marginLeft: '0.5rem',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #e2e8f0',
                  width: '150px',
                }}
              />
            </label>
          </div>
          <button className="primary" onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? 'Analyzing...' : 'Run AI Analysis'}
          </button>
          <button className="ghost" onClick={loadEmployees}>
            Refresh Data
          </button>
        </div>
      </header>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '1rem', borderRadius: '0.5rem', margin: '1rem 0' }}>
          <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>
        </div>
      )}

      {analysisSummary && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1rem', borderRadius: '0.5rem', margin: '1rem 0' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#15803d' }}>Analysis Complete</h4>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            Projected {analysisSummary.projectedSavingsType}: <strong>{analysisSummary.projectedSavingsFormatted}</strong>
          </p>
        </div>
      )}

      <section className="summary-grid">
        <article className="summary-card">
          <p>Total net profit</p>
          <h2>{formatter.format(orgSummary.netProfit)}</h2>
          <span className="trend positive">↑ Live calculation</span>
        </article>
        <article className="summary-card">
          <p>Compensation burn</p>
          <h2>{formatter.format(orgSummary.totalSalary)}</h2>
          <span className="trend neutral">Total salaries</span>
        </article>
        <article className="summary-card">
          <p>Margin</p>
          <h2>{(orgSummary.margin * 100).toFixed(1)}%</h2>
          <span className="trend positive">Goal ≥ 28%</span>
        </article>
        <article className="summary-card">
          <p>Employees flagged</p>
          <h2>
            {orgSummary.atRisk} / {employees.length}
          </h2>
          <span className="trend warning">Negative profit</span>
        </article>
      </section>

      <section className="panels">
        <div className="panel primary-panel">
          <header className="panel-header">
            <div>
              <h3>Employee profitability radar</h3>
              <p>Select a profile to inspect the AI recommendation.</p>
            </div>
            <div className="legend">
              {(['increase', 'keep', 'decrease', 'fire'] as UIDecisionAction[]).map((action) => (
                <span key={action}>
                  <span className="legend-dot" style={{ background: decisionPalette[action] }} />
                  {action}
                </span>
              ))}
            </div>
          </header>

          <div className="employee-table">
            <div className="employee-row header">
              <span>Employee</span>
              <span>Role</span>
              <span>Profit</span>
              <span>Performance</span>
              <span>Decision</span>
            </div>

            {employees.filter(emp => emp.status !== 'FIRED').map((employee) => {
              const profit = (employee.revenue || 0) - (employee.salary || 0)
              const margin = employee.revenue ? profit / employee.revenue : 0
              const action = mapBackendAction(employee.suggestion?.action)
              return (
                <button
                  key={employee.ssid}
                  className={`employee-row ${employee.ssid === selectedEmployeeId ? 'selected' : ''}`}
                  onClick={() => updateSelected(employee)}
                >
                  <span>
                    <strong>{employee.name}</strong>
                    <small>{employee.ssid}</small>
                  </span>
                  <span>
                    {employee.role}
                    <small>{employee.experience} • {employee.performance}</small>
                  </span>
                  <span>
                    {formatter.format(profit)}
                    <small>Margin {(margin * 100).toFixed(1)}%</small>
                  </span>
                  <span className={`performance ${employee.performance}`}>{employee.performance}</span>
                  <span>
                    <DecisionBadge action={action} />
                  </span>
                </button>
              )
            })}

            {employees.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                No employees found. Add employees via the API.
              </div>
            )}
          </div>
        </div>

        <aside className="panel detail-panel">
          {selectedEmployee ? (
            <>
              <section className="detail-card">
                <div className="detail-header">
                  <div>
                    <p className="eyebrow">
                      {selectedEmployee.experience} • {selectedEmployee.performance}
                    </p>
                    <h3>{selectedEmployee.name}</h3>
                    <p>{selectedEmployee.role}</p>
                  </div>
                  <DecisionBadge action={selectedDecision.action} />
                </div>

                <div className="detail-grid">
                  <article>
                    <p>Profit capture</p>
                    <h4>{formatter.format(selectedDecision.profitability)}</h4>
                    <small>Margin {(selectedDecision.margin * 100).toFixed(1)}%</small>
                  </article>
                  <article>
                    <p>Confidence</p>
                    <h4>{(selectedDecision.confidence * 100).toFixed(0)}%</h4>
                    <small>AI certainty score</small>
                  </article>
                  <article>
                    <p>Salary</p>
                    <h4>{formatter.format(selectedEmployee.salary || 0)}</h4>
                    <small>Current</small>
                  </article>
                </div>

                <p className="reasoning">{selectedDecision.reason}</p>

                {selectedEmployee.suggestion && (
                  <div style={{ marginTop: '1rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>AI Recommendation</h4>
                    {selectedDecision.suggestedSalary && (
                      <p style={{ fontSize: '0.875rem', color: '#475569' }}>
                        Suggested salary: <strong>{formatter.format(selectedDecision.suggestedSalary)}</strong>
                        {selectedDecision.changePercent !== undefined && (
                          <span> ({selectedDecision.changePercent >= 0 ? '+' : ''}{selectedDecision.changePercent.toFixed(1)}%)</span>
                        )}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                      <button
                        className="primary"
                        onClick={() => handleApplyAction(selectedDecision.action)}
                        disabled={applyingAction}
                        style={{ background: decisionPalette[selectedDecision.action] }}
                      >
                        {applyingAction ? 'Applying...' : `Apply: ${selectedDecision.action}`}
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="detail-card">
                <h4>Action History</h4>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {actions
                    .filter((a) => a.ssid === selectedEmployee.ssid)
                    .slice(0, 5)
                    .map((action) => (
                      <div
                        key={action._id}
                        style={{
                          padding: '0.5rem',
                          borderBottom: '1px solid #e2e8f0',
                          fontSize: '0.875rem',
                        }}
                      >
                        <strong>{action.action}</strong>
                        <span style={{ color: '#64748b', marginLeft: '0.5rem' }}>
                          {new Date(action.appliedAt).toLocaleDateString()}
                        </span>
                        <p style={{ margin: '0.25rem 0 0', color: '#475569' }}>{action.details.effect}</p>
                      </div>
                    ))}
                  {actions.filter((a) => a.ssid === selectedEmployee.ssid).length === 0 && (
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No actions taken yet.</p>
                  )}
                </div>
              </section>

              <section className="detail-card">
                <h4>Automation playbook</h4>
                <ol className="automation-steps">
                  <li>
                    <strong>1. Stream & normalize</strong>
                    <p>Collect finance, HRIS, and CRM signals into the feature lake.</p>
                  </li>
                  <li>
                    <strong>2. Reason & decide</strong>
                    <p>Agentic chain maps profit, role criticality, and people risk to actions.</p>
                  </li>
                  <li>
                    <strong>3. Approve & trigger</strong>
                    <p>Exec signs digitally; downstream Workday / ServiceNow flows auto-fire.</p>
                  </li>
                </ol>
              </section>

              <section className="detail-card">
                <h4>Additional factors tracked</h4>
                <div className="chip-grid">
                  {factorLibrary.map((factor) => (
                    <article key={factor.label} className="chip">
                      <strong>{factor.label}</strong>
                      <p>{factor.detail}</p>
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="detail-card">
              <p style={{ color: '#64748b' }}>Select an employee to view details</p>
            </section>
          )}
        </aside>
      </section>
    </div>
  )
}

export default App

