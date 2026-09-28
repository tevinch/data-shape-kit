import {lazy} from 'react';
import Draggable, {DraggableCore} from 'react-draggable';
const LazyDraggable = lazy(() => import('react-draggable'));
const LazyCore = lazy(() => import('react-draggable').then(m => ({default: m.DraggableCore})));
export const direct = <><Draggable><div /></Draggable><DraggableCore><div /></DraggableCore></>;
export const loaded = <><LazyDraggable axis="x"><div /></LazyDraggable><LazyCore scale={2}><div /></LazyCore></>;
// @ts-expect-error Invalid axis must not be accepted.
export const badAxis = <LazyDraggable axis="diagonal"><div /></LazyDraggable>;
// @ts-expect-error Invalid scale must not be accepted.
export const badScale = <LazyCore scale="large"><div /></LazyCore>;
