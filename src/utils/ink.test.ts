import { describe, expect, it } from 'vitest'
import { touchesStroke } from './ink'
describe('ink eraser', () => {
 it('hits the middle of a long stroke between pointer samples', () => { expect(touchesStroke({x:50,y:8},[{x:0,y:0},{x:100,y:0}],16)).toBe(true) })
 it('leaves a distant stroke intact', () => { expect(touchesStroke({x:50,y:30},[{x:0,y:0},{x:100,y:0}],16)).toBe(false) })
 it('erases a single pen dot and handles an empty surface', () => { expect(touchesStroke({x:5,y:5},[{x:5,y:5}],16)).toBe(true); expect(touchesStroke({x:0,y:0},[],16)).toBe(false) })
})
