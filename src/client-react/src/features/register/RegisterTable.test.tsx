import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { RegisterTable } from './RegisterTable'

const assets = [
  { no: 'S1', desc: 'Site one' },
  { no: 'S1-B1', desc: 'Building one', parent: 'S1' },
  { no: 'S1-B1-AC 01', desc: 'Air conditioner', parent: 'S1-B1' },
]

const many = Array.from({ length: 26 }, (_, i) => ({ no: `A-${String(i + 1).padStart(2, '0')}`, desc: `Asset ${i + 1}` }))

describe('RegisterTable', () => {
  it('renders asset rows', () => {
    render(<RegisterTable assets={assets} />)
    expect(screen.getByText('S1-B1-AC 01')).toBeInTheDocument()
    expect(screen.getByText('Building one')).toBeInTheDocument()
  })

  it('filters by search text across no and description', async () => {
    render(<RegisterTable assets={assets} />)
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'air')
    expect(screen.getByText('S1-B1-AC 01')).toBeInTheDocument()
    expect(screen.queryByText('Site one')).not.toBeInTheDocument()
  })

  it('pages through results with Next and Previous', async () => {
    render(<RegisterTable assets={many} />)
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('A-26')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous' })).not.toBeDisabled()
  })

  it('resets to page 1 when the search changes', async () => {
    render(<RegisterTable assets={many} />)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.type(screen.getByRole('textbox', { name: /search/i }), 'asset 1')
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
    expect(screen.getByText('A-01')).toBeInTheDocument()
  })
})
