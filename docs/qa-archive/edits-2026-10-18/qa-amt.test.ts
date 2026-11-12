import { test, expect } from 'vitest'; import { parseQuoteAmount } from '@/lib/maintenance-quotes/quotes'
test('amt', () => { expect(Object.fromEntries(['49.99','50','100','100.01','-5','abc','$75'].map(a=>[a, parseQuoteAmount(a).ok]))).toEqual({}) })
