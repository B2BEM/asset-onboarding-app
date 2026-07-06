import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CountUp from '@/components/CountUp'

describe('CountUp (react-bits registry install)', () => {
  it('mounts without crashing under jsdom', () => {
    const { container } = render(<CountUp to={42} duration={0.1} />)
    expect(container.firstChild).not.toBeNull()
  })
})
