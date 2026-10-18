import { describe, expect, it } from 'vitest'
import { sizeOfChangeType } from './billing'
import { CHANGE_TYPES } from '@/lib/help/help-chat-content'


describe('sizeOfChangeType', () => {
  it('the three named chat choices are small edits; "Something else" is unknown', () => {
    expect(CHANGE_TYPES.map(sizeOfChangeType)).toEqual(['small', 'small', 'small', null])
  })
})

// Oct 18: classifyChangeBilling is covered in src/lib/plans/edit-allowance.test.ts (add-on routes retired).
