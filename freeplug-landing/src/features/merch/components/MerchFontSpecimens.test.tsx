import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'
import { MerchFontSpecimens } from './MerchFontSpecimens'
import en from '../../../../messages/en.json'

describe('MerchFontSpecimens', () => {
  it('renders three family specimen blocks with preview font classes', () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <div className="merch-font-preview">
          <MerchFontSpecimens />
        </div>
      </NextIntlClientProvider>
    )
    expect(screen.getByTestId('merch-specimen-cursive').querySelector('.merch-specimen-cursive')).toBeTruthy()
    expect(screen.getByTestId('merch-specimen-dispatch').querySelector('.merch-specimen-dispatch-bold')).toBeTruthy()
    expect(screen.getByTestId('merch-specimen-extended').querySelector('.merch-specimen-extended')).toBeTruthy()
    expect(screen.getAllByText('FREEPLUG').length).toBeGreaterThanOrEqual(2)
  })
})
