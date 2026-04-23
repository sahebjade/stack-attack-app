import React, { useReducer, useState, useRef, useCallback, useEffect } from 'react';

// ============================================================================
// RESPONSIVE HOOK
// ============================================================================
const useIsMobile = (breakpoint = 640) => {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w < breakpoint;
};

// ============================================================================
// GAME LOGIC
// ============================================================================

// Generate n unique random integers in [min, max]
const generateDeck = (n = 8, min = 1, max = 99) => {
  const deck = new Set();
  while (deck.size < n) {
    deck.add(Math.floor(Math.random() * (max - min + 1)) + min);
  }
  return Array.from(deck);
};

// Pre-compute bottom-up merge operations for n elements
const buildMergeOps = (n) => {
  const ops = [];
  let size = 1;
  while (size < n) {
    for (let start = 0; start < n; start += size * 2) {
      const mid = Math.min(start + size, n);
      const end = Math.min(start + size * 2, n);
      if (mid < end) ops.push({ start, mid, end });
    }
    size *= 2;
  }
  return ops;
};

// Compute current group boundaries for merge sort visualization
const computeMergeGroups = (mergeOps, currentOpIdx, n) => {
  const groupOf = Array.from({ length: n }, (_, i) => i);
  let nextId = n;
  for (let i = 0; i < currentOpIdx && i < mergeOps.length; i++) {
    const gid = nextId++;
    for (let j = mergeOps[i].start; j < mergeOps[i].end; j++) groupOf[j] = gid;
  }
  const groups = [];
  let i = 0;
  while (i < n) {
    const gid = groupOf[i];
    let j = i + 1;
    while (j < n && groupOf[j] === gid) j++;
    groups.push({ start: i, end: j, size: j - i });
    i = j;
  }
  return groups;
};

// Get human-readable merge level info
const getMergeLevelInfo = (mergeOps, currentOpIdx, n) => {
  let size = 1;
  let opCount = 0;
  let level = 1;
  while (size < n) {
    let levelOps = 0;
    for (let start = 0; start < n; start += size * 2) {
      const mid = Math.min(start + size, n);
      const end = Math.min(start + size * 2, n);
      if (mid < end) levelOps++;
    }
    if (opCount + levelOps > currentOpIdx) {
      const opInLevel = currentOpIdx - opCount;
      const targetSize = size * 2;
      const totalLevels = Math.ceil(Math.log2(n));
      let desc, shortDesc;
      if (size === 1) {
        desc = `Pass ${level} of ${totalLevels}: Combine single cards into sorted pairs`;
        shortDesc = 'Making sorted pairs';
      } else if (targetSize >= n) {
        desc = `Pass ${level} of ${totalLevels}: Final merge — combine everything into one sorted row`;
        shortDesc = 'Final merge!';
      } else {
        desc = `Pass ${level} of ${totalLevels}: Combine groups of ${size} into sorted groups of ${targetSize}`;
        shortDesc = `Making groups of ${targetSize}`;
      }
      return { level, totalLevels, desc, shortDesc, opInLevel: opInLevel + 1, opsThisLevel: levelOps, targetSize };
    }
    opCount += levelOps;
    size *= 2;
    level++;
  }
  return { level, totalLevels: level, desc: 'All merged!', shortDesc: 'Done', opInLevel: 0, opsThisLevel: 0, targetSize: n };
};

// Compute theoretical minimum comparisons for each algorithm on a given deck
const computeMins = (deck) => {
  const n = deck.length;

  // Bubble: no early termination in this game → always n*(n-1)/2
  const bubble = n * (n - 1) / 2;

  // Selection: always scans full remaining subarray → n*(n-1)/2
  const selection = n * (n - 1) / 2;

  // Insertion: simulate optimal play
  const insertionArr = [...deck];
  let insertionComps = 0;
  for (let i = 1; i < n; i++) {
    const val = insertionArr[i];
    let j = i - 1;
    while (j >= 0 && insertionArr[j] > val) {
      insertionArr[j + 1] = insertionArr[j];
      j--;
      insertionComps++;
    }
    if (j >= 0) insertionComps++; // drop comparison (found a ≤ element)
    insertionArr[j + 1] = val;
  }

  // Merge (bottom-up): simulate actual merge comparisons
  const mergeArr = [...deck];
  const mergeOps = buildMergeOps(n);
  let mergeComps = 0;
  for (const op of mergeOps) {
    const left = mergeArr.slice(op.start, op.mid);
    const right = mergeArr.slice(op.mid, op.end);
    const merged = [];
    let li = 0, ri = 0;
    while (li < left.length && ri < right.length) {
      mergeComps++;
      if (left[li] <= right[ri]) merged.push(left[li++]);
      else merged.push(right[ri++]);
    }
    while (li < left.length) merged.push(left[li++]);
    while (ri < right.length) merged.push(right[ri++]);
    for (let k = 0; k < merged.length; k++) mergeArr[op.start + k] = merged[k];
  }

  // Quick: simulate with median-of-subarray pivot (optimal play)
  const computeQuickComps = (arr, start, end) => {
    if (end - start <= 1) return 0;
    const sub = arr.slice(start, end);
    sub.sort((a, b) => a - b);
    const medianVal = sub[Math.floor(sub.length / 2)];
    // Find pivot index in original array
    let pivotIdx = start;
    for (let i = start; i < end; i++) {
      if (arr[i] === medianVal) { pivotIdx = i; break; }
    }
    const pivotVal = arr[pivotIdx];
    const left = [], right = [];
    for (let i = start; i < end; i++) {
      if (i === pivotIdx) continue;
      if (arr[i] < pivotVal) left.push(arr[i]);
      else right.push(arr[i]);
    }
    const comps = end - start - 1; // compare each non-pivot element
    // Reconstruct array for recursive calls
    const newArr = [...arr];
    let pos = start;
    for (const v of left) newArr[pos++] = v;
    const newPivotIdx = pos;
    newArr[pos++] = pivotVal;
    for (const v of right) newArr[pos++] = v;
    return comps
      + computeQuickComps(newArr, start, newPivotIdx)
      + computeQuickComps(newArr, newPivotIdx + 1, end);
  };
  const quick = computeQuickComps([...deck], 0, n);

  // Heap: simulate heap sort comparisons
  const heapArr = [...deck];
  let heapComps = 0;
  const siftDown = (arr, pos, sz) => {
    while (true) {
      let largest = pos;
      const left = 2 * pos + 1;
      const right = 2 * pos + 2;
      if (left < sz) {
        heapComps++;
        if (arr[left] > arr[largest]) largest = left;
      }
      if (right < sz) {
        heapComps++;
        if (arr[right] > arr[largest]) largest = right;
      }
      if (largest !== pos) {
        [arr[pos], arr[largest]] = [arr[largest], arr[pos]];
        pos = largest;
      } else break;
    }
  };
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) siftDown(heapArr, i, n);
  let heapSz = n;
  while (heapSz > 1) {
    [heapArr[0], heapArr[heapSz - 1]] = [heapArr[heapSz - 1], heapArr[0]];
    heapSz--;
    siftDown(heapArr, 0, heapSz);
  }

  // Radix: no comparisons, count placements (n per pass, 2 passes for 1-99)
  const radix = n * 2;

  return { bubble, selection, insertion: insertionComps, merge: mergeComps, quick, heap: heapComps, radix };
};

const SCHOOL_NAMES = {
  bubble: 'Bubble Monks',
  quick: 'Quick Order',
  insertion: 'Insertion Lodge',
  selection: 'Selection Circle',
  merge: 'Merge Guild',
  heap: 'Heap Fortress',
  radix: 'Radix Alchemists',
};

const makePlayerState = (deck, school) => {
  const n = deck.length;
  const base = {
    school,
    lane: deck.map((v, i) => ({ id: i, value: v, locked: false })),
    comparisons: 0,
    swaps: 0,
    penalties: 0,
    highlights: {},
    finished: false,
    pendingAction: null,
  };

  if (school === 'bubble') {
    return { ...base, pawn: 0, passEnd: n };
  }
  if (school === 'quick') {
    return {
      ...base,
      quickPhase: 'choose_pivot',
      pivotIdx: null,
      activeRange: [0, n],
      compareIdx: null,
      pendingRanges: [],
    };
  }
  if (school === 'insertion') {
    return {
      ...base,
      insertionSorted: 1,       // first card is trivially sorted
      heldCardIdx: null,        // original index of card being inserted
      scanPos: null,            // comparison target (moves left)
      insertionPhase: 'ready',  // 'ready' | 'comparing'
    };
  }
  if (school === 'selection') {
    return {
      ...base,
      selectionScanStart: 0,
      selectionScanIdx: 1,
      selectionMinIdx: 0,
      selectionPhase: 'scanning', // 'scanning' | 'confirm_swap'
    };
  }
  if (school === 'merge') {
    const mergeOps = buildMergeOps(n);
    return {
      ...base,
      mergeOps,
      currentMergeOpIdx: 0,
      mergeState: null,
      mergePhase: 'start_merge', // 'start_merge' | 'comparing' | 'auto_append'
    };
  }
  if (school === 'heap') {
    return {
      ...base,
      heapPhase: 'building',        // 'building' | 'extract_swap' | 'extract_sift' | 'done'
      heapBuildIdx: Math.floor(n / 2) - 1, // sift down from here to 0
      heapSize: n,
      siftPos: null,                // current position during sift-down
      siftState: null,              // null | 'ready' | 'comparing'
    };
  }
  if (school === 'radix') {
    return {
      ...base,
      radixPass: 0,                 // 0 = ones digit, 1 = tens digit
      radixCardIdx: 0,              // which card we're placing
      radixBuckets: Array.from({ length: 10 }, () => []),
      radixPhase: 'placing',        // 'placing' | 'collecting' | 'done'
    };
  }
  return base;
};

const initialState = (school, mode, deckSize = 8) => {
  const deck = generateDeck(deckSize);
  const mins = computeMins(deck);
  return {
    mode,
    deckSize,
    deck,
    mins,
    players: [makePlayerState(deck, school)],
    log: [{
      type: 'start',
      text: `Random deck. School: ${SCHOOL_NAMES[school] || school}.`,
    }],
  };
};

// Apply a reducer action to a specific player's state
// Helper: finalize insertion — the card is already at heldCardIdx in the lane (swapped into place).
// Just advance to the next unsorted card.
function doInsertionFinish(state, comparisons, swaps, playerNum, logEntry) {
  const nextSorted = state.insertionSorted + 1;
  const allDone = nextSorted >= state.lane.length;

  const logEntries = [logEntry];
  if (allDone) {
    logEntries.push({ type: 'done', text: `P${playerNum} finished: ${comparisons} comp, ${swaps} shifts.` });
  }

  return {
    ...state,
    lane: allDone ? state.lane.map(c => ({ ...c, locked: true })) : state.lane,
    comparisons,
    swaps,
    insertionSorted: nextSorted,
    heldCardIdx: null,
    scanPos: null,
    insertionPhase: 'ready',
    highlights: {},
    pendingAction: null,
    finished: allDone,
    _logEntries: logEntries,
  };
}

function playerReducer(state, action) {
  switch (action.type) {
    case 'BUBBLE_SETUP_COMPARE': {
      if (state.finished) return state;
      const leftIdx = state.pawn;
      const rightIdx = state.pawn + 1;
      if (rightIdx >= state.passEnd) return state;
      const left = state.lane[leftIdx].value;
      const right = state.lane[rightIdx].value;
      return {
        ...state,
        highlights: { [leftIdx]: 'compare_left', [rightIdx]: 'compare_right' },
        pendingAction: { type: 'bubble_compare', leftIdx, rightIdx, left, right, shouldSwap: left > right },
      };
    }

    case 'BUBBLE_EXECUTE': {
      if (!state.pendingAction || state.pendingAction.type !== 'bubble_compare') return state;
      const { leftIdx, rightIdx, left, right, shouldSwap } = state.pendingAction;
      const correct = action.swap === shouldSwap;
      if (!correct) {
        return {
          ...state,
          penalties: state.penalties + 1,
          highlights: {},
          pendingAction: null,
          _logEntry: { type: 'penalty', text: `P${action.playerNum}: Wrong call on ${left} vs ${right}.` },
        };
      }

      let newLane = [...state.lane];
      let newSwaps = state.swaps;
      if (shouldSwap) {
        [newLane[leftIdx], newLane[rightIdx]] = [newLane[rightIdx], newLane[leftIdx]];
        newSwaps += 1;
      }
      const newComparisons = state.comparisons + 1;
      const newPawn = state.pawn + 1;
      const finishedPass = newPawn + 1 >= state.passEnd;
      let newPassEnd = state.passEnd;
      let finalLane = newLane;
      let finalPawn = newPawn;
      let logEntries = [{
        type: 'action',
        text: `P${action.playerNum}: ${left} vs ${right} → ${shouldSwap ? 'swap' : 'keep'}.`,
      }];

      if (finishedPass) {
        const lockIdx = state.passEnd - 1;
        finalLane = newLane.map((c, i) => i === lockIdx ? { ...c, locked: true } : c);
        newPassEnd = state.passEnd - 1;
        finalPawn = 0;
        while (finalPawn < finalLane.length && finalLane[finalPawn].locked) finalPawn += 1;
        logEntries.push({ type: 'lock', text: `P${action.playerNum}: Locked ${finalLane[lockIdx].value}.` });

        // If only one unlocked card remains, it's already in place — lock it too
        if (newPassEnd <= 1) {
          finalLane = finalLane.map(c => c.locked ? c : { ...c, locked: true });
        }
      }

      const allLocked = finalLane.every(c => c.locked);
      if (allLocked) {
        logEntries.push({ type: 'done', text: `P${action.playerNum} finished: ${newComparisons} comp, ${newSwaps} swap.` });
      }

      return {
        ...state,
        lane: finalLane,
        comparisons: newComparisons,
        swaps: newSwaps,
        pawn: finalPawn,
        passEnd: newPassEnd,
        highlights: {},
        pendingAction: null,
        finished: allLocked,
        _logEntries: logEntries,
      };
    }

    case 'QUICK_CHOOSE_PIVOT': {
      if (state.finished || state.quickPhase !== 'choose_pivot') return state;
      const [start, end] = state.activeRange;
      if (action.idx < start || action.idx >= end) return state;
      let firstCompare = start;
      if (firstCompare === action.idx) firstCompare += 1;
      return {
        ...state,
        pivotIdx: action.idx,
        quickPhase: 'comparing',
        compareIdx: firstCompare,
        highlights: { [action.idx]: 'pivot', ...(firstCompare < end ? { [firstCompare]: 'compare' } : {}) },
        _logEntry: { type: 'action', text: `P${action.playerNum}: Chose pivot ${state.lane[action.idx].value}.` },
      };
    }

    case 'QUICK_SETUP_COMPARE': {
      if (state.finished || state.quickPhase !== 'comparing') return state;
      const cardIdx = state.compareIdx;
      const [start, end] = state.activeRange;
      if (cardIdx >= end) return state;
      const cardVal = state.lane[cardIdx].value;
      const pivotVal = state.lane[state.pivotIdx].value;
      return {
        ...state,
        highlights: { ...state.highlights, [cardIdx]: 'compare', [state.pivotIdx]: 'pivot' },
        pendingAction: { type: 'quick_compare', cardIdx, cardVal, pivotVal, toBlue: cardVal < pivotVal },
      };
    }

    case 'QUICK_EXECUTE': {
      if (!state.pendingAction || state.pendingAction.type !== 'quick_compare') return state;
      const { cardIdx, cardVal, pivotVal, toBlue } = state.pendingAction;
      const correct = action.toBlue === toBlue;
      if (!correct) {
        return {
          ...state,
          penalties: state.penalties + 1,
          highlights: { [state.pivotIdx]: 'pivot' },
          pendingAction: null,
          _logEntry: { type: 'penalty', text: `P${action.playerNum}: Wrong partition call.` },
        };
      }
      let newSwaps = state.swaps;
      if (toBlue) newSwaps += 1;
      const nextHighlights = { ...state.highlights };
      nextHighlights[cardIdx] = toBlue ? 'blue' : 'red';
      nextHighlights[state.pivotIdx] = 'pivot';
      const [start, end] = state.activeRange;
      let nextCompare = cardIdx + 1;
      if (nextCompare === state.pivotIdx) nextCompare += 1;
      const newComparisons = state.comparisons + 1;
      const logEntry = { type: 'action', text: `P${action.playerNum}: ${cardVal} → ${toBlue ? 'LEFT' : 'RIGHT'}.` };
      if (nextCompare >= end) {
        return {
          ...state,
          comparisons: newComparisons,
          swaps: newSwaps,
          highlights: nextHighlights,
          quickPhase: 'seal',
          pendingAction: null,
          _logEntry: logEntry,
        };
      }
      nextHighlights[nextCompare] = 'compare';
      return {
        ...state,
        comparisons: newComparisons,
        swaps: newSwaps,
        highlights: nextHighlights,
        compareIdx: nextCompare,
        pendingAction: null,
        _logEntry: logEntry,
      };
    }

    case 'QUICK_SEAL': {
      if (state.quickPhase !== 'seal') return state;
      const [start, end] = state.activeRange;
      const blues = [];
      const reds = [];
      for (let i = start; i < end; i++) {
        if (i === state.pivotIdx) continue;
        const h = state.highlights[i];
        if (h === 'blue') blues.push(state.lane[i]);
        else reds.push(state.lane[i]);
      }
      const pivotCard = { ...state.lane[state.pivotIdx], locked: true };
      const newSection = [...blues, pivotCard, ...reds];
      const newLane = state.lane.map((c, i) =>
        (i < start || i >= end) ? c : newSection[i - start]
      );
      const pivotFinalIdx = start + blues.length;
      const newPending = [...state.pendingRanges];
      if (blues.length >= 2) newPending.push([start, start + blues.length]);
      if (reds.length >= 2) newPending.push([pivotFinalIdx + 1, end]);
      let finalLane = [...newLane];
      if (blues.length === 1) {
        finalLane = finalLane.map((c, i) => i === start ? { ...c, locked: true } : c);
      }
      if (reds.length === 1) {
        finalLane = finalLane.map((c, i) => i === pivotFinalIdx + 1 ? { ...c, locked: true } : c);
      }
      const logEntries = [{ type: 'lock', text: `P${action.playerNum}: Sealed. ${pivotCard.value} locked.` }];
      if (newPending.length === 0) {
        const allLocked = finalLane.every(c => c.locked);
        if (allLocked) logEntries.push({ type: 'done', text: `P${action.playerNum} finished: ${state.comparisons} comp, ${state.swaps} swap.` });
        return {
          ...state,
          lane: finalLane,
          quickPhase: allLocked ? 'done' : 'choose_pivot',
          pivotIdx: null,
          activeRange: allLocked ? [0, 0] : [0, finalLane.length],
          compareIdx: null,
          pendingRanges: [],
          highlights: {},
          pendingAction: null,
          finished: allLocked,
          _logEntries: logEntries,
        };
      }
      const nextRange = newPending.pop();
      return {
        ...state,
        lane: finalLane,
        quickPhase: 'choose_pivot',
        pivotIdx: null,
        activeRange: nextRange,
        compareIdx: null,
        pendingRanges: newPending,
        highlights: {},
        pendingAction: null,
        _logEntries: logEntries,
      };
    }

    // ====== INSERTION SORT ======
    // heldCardIdx = where the held card currently sits in the lane
    // scanPos = card we're comparing against (one to the left of held)
    // On shift: swap held card with blocking card in the lane (held moves left, blocker moves right)
    // On drop: card is already in position, just finalize
    case 'INSERTION_SETUP_COMPARE': {
      if (state.finished || state.school !== 'insertion') return state;
      if (state.insertionSorted >= state.lane.length) return state;

      const heldIdx = state.heldCardIdx !== null ? state.heldCardIdx : state.insertionSorted;
      const scanP = state.scanPos !== null ? state.scanPos : state.insertionSorted - 1;
      const heldVal = state.lane[heldIdx].value;
      const cmpVal = state.lane[scanP].value;
      const shouldShift = cmpVal > heldVal;

      return {
        ...state,
        heldCardIdx: heldIdx,
        scanPos: scanP,
        insertionPhase: 'comparing',
        highlights: { [heldIdx]: 'compare_right', [scanP]: 'compare_left' },
        pendingAction: { type: 'insertion_compare', heldVal, cmpVal, scanP, shouldShift },
      };
    }

    case 'INSERTION_EXECUTE': {
      if (!state.pendingAction || state.pendingAction.type !== 'insertion_compare') return state;
      const { heldVal, cmpVal, scanP, shouldShift } = state.pendingAction;
      const correct = action.shift === shouldShift;
      if (!correct) {
        return {
          ...state,
          penalties: state.penalties + 1,
          highlights: { [state.heldCardIdx]: 'compare_right' },
          pendingAction: null,
          insertionPhase: 'ready',
          _logEntry: { type: 'penalty', text: `P${action.playerNum}: Wrong call on ${heldVal} vs ${cmpVal}.` },
        };
      }
      const newComparisons = state.comparisons + 1;

      if (shouldShift) {
        // Swap held card with blocking card in the lane
        const newLane = [...state.lane];
        const heldIdx = state.heldCardIdx;
        [newLane[heldIdx], newLane[scanP]] = [newLane[scanP], newLane[heldIdx]];
        const newSwaps = state.swaps + 1;
        const logEntry = { type: 'action', text: `P${action.playerNum}: ${cmpVal} > ${heldVal}, slide ${cmpVal} right.` };

        // Held card is now at scanP
        const newHeldIdx = scanP;
        const nextScan = scanP - 1;

        if (nextScan < 0) {
          // Reached position 0, card is in place
          const finishLog = { type: 'lock', text: `P${action.playerNum}: ${heldVal} placed at position 1.` };
          return doInsertionFinish(
            { ...state, lane: newLane, heldCardIdx: newHeldIdx },
            newComparisons, newSwaps, action.playerNum, logEntry
          );
        }
        // More room to scan left
        return {
          ...state,
          lane: newLane,
          comparisons: newComparisons,
          swaps: newSwaps,
          heldCardIdx: newHeldIdx,
          scanPos: nextScan,
          insertionPhase: 'ready',
          highlights: { [newHeldIdx]: 'compare_right' },
          pendingAction: null,
          _logEntry: logEntry,
        };
      } else {
        // Card fits here, it's already in position (no swap needed)
        const logEntry = { type: 'lock', text: `P${action.playerNum}: ${heldVal} placed at position ${state.heldCardIdx + 1}.` };
        return doInsertionFinish(state, newComparisons, state.swaps, action.playerNum, logEntry);
      }
    }

    // ====== SELECTION SORT ======
    case 'SELECTION_SETUP_COMPARE': {
      if (state.finished || state.school !== 'selection') return state;
      if (state.selectionPhase !== 'scanning') return state;
      const scanIdx = state.selectionScanIdx;
      const minIdx = state.selectionMinIdx;
      if (scanIdx >= state.lane.length) return state;
      const scanVal = state.lane[scanIdx].value;
      const minVal = state.lane[minIdx].value;
      const isNewMin = scanVal < minVal;
      return {
        ...state,
        highlights: { [scanIdx]: 'compare_right', [minIdx]: 'compare_left' },
        pendingAction: { type: 'selection_compare', scanIdx, scanVal, minIdx, minVal, isNewMin },
      };
    }

    case 'SELECTION_EXECUTE': {
      if (!state.pendingAction || state.pendingAction.type !== 'selection_compare') return state;
      const { scanIdx, scanVal, minIdx, minVal, isNewMin } = state.pendingAction;
      const correct = action.isNewMin === isNewMin;
      if (!correct) {
        return {
          ...state,
          penalties: state.penalties + 1,
          highlights: {},
          pendingAction: null,
          _logEntry: { type: 'penalty', text: `P${action.playerNum}: Wrong call: ${scanVal} vs current min ${minVal}.` },
        };
      }
      const newComparisons = state.comparisons + 1;
      const newMinIdx = isNewMin ? scanIdx : minIdx;
      const nextScanIdx = scanIdx + 1;
      const logEntry = { type: 'action', text: `P${action.playerNum}: ${scanVal} ${isNewMin ? '<' : '≥'} ${minVal} → ${isNewMin ? 'new min' : 'keep min'}.` };

      if (nextScanIdx >= state.lane.length) {
        // Scan complete, move to confirm_swap
        return {
          ...state,
          comparisons: newComparisons,
          selectionMinIdx: newMinIdx,
          selectionScanIdx: nextScanIdx,
          selectionPhase: 'confirm_swap',
          highlights: { [newMinIdx]: 'pivot', [state.selectionScanStart]: 'compare_left' },
          pendingAction: null,
          _logEntry: logEntry,
        };
      }
      return {
        ...state,
        comparisons: newComparisons,
        selectionMinIdx: newMinIdx,
        selectionScanIdx: nextScanIdx,
        highlights: {},
        pendingAction: null,
        _logEntry: logEntry,
      };
    }

    case 'SELECTION_SWAP': {
      if (state.selectionPhase !== 'confirm_swap') return state;
      const { selectionScanStart, selectionMinIdx } = state;
      let newLane = [...state.lane];
      let newSwaps = state.swaps;
      const logEntries = [];
      if (selectionMinIdx !== selectionScanStart) {
        [newLane[selectionScanStart], newLane[selectionMinIdx]] = [newLane[selectionMinIdx], newLane[selectionScanStart]];
        newSwaps += 1;
        logEntries.push({ type: 'action', text: `P${action.playerNum}: Swap ${newLane[selectionScanStart].value} into position ${selectionScanStart + 1}.` });
      } else {
        logEntries.push({ type: 'action', text: `P${action.playerNum}: ${newLane[selectionScanStart].value} already in place.` });
      }
      newLane[selectionScanStart] = { ...newLane[selectionScanStart], locked: true };
      logEntries.push({ type: 'lock', text: `P${action.playerNum}: Locked ${newLane[selectionScanStart].value}.` });

      const nextStart = selectionScanStart + 1;
      // If only one element left, lock it too
      if (nextStart >= newLane.length - 1) {
        if (nextStart < newLane.length) {
          newLane[nextStart] = { ...newLane[nextStart], locked: true };
        }
        logEntries.push({ type: 'done', text: `P${action.playerNum} finished: ${state.comparisons} comp, ${newSwaps} swap.` });
        return {
          ...state,
          lane: newLane,
          swaps: newSwaps,
          selectionScanStart: nextStart,
          selectionScanIdx: nextStart + 1,
          selectionMinIdx: nextStart,
          selectionPhase: 'scanning',
          highlights: {},
          pendingAction: null,
          finished: true,
          _logEntries: logEntries,
        };
      }
      return {
        ...state,
        lane: newLane,
        swaps: newSwaps,
        selectionScanStart: nextStart,
        selectionScanIdx: nextStart + 1,
        selectionMinIdx: nextStart,
        selectionPhase: 'scanning',
        highlights: {},
        pendingAction: null,
        _logEntries: logEntries,
      };
    }

    // ====== MERGE SORT ======
    case 'MERGE_START': {
      if (state.finished || state.school !== 'merge') return state;
      if (state.mergePhase !== 'start_merge') return state;
      const op = state.mergeOps[state.currentMergeOpIdx];
      if (!op) return state;
      const leftCards = state.lane.slice(op.start, op.mid).map(c => ({ ...c }));
      const rightCards = state.lane.slice(op.mid, op.end).map(c => ({ ...c }));
      const highlights = {};
      for (let i = op.start; i < op.mid; i++) highlights[i] = 'blue';
      for (let i = op.mid; i < op.end; i++) highlights[i] = 'red';
      return {
        ...state,
        mergePhase: 'comparing',
        mergeState: { leftCards, rightCards, leftPos: 0, rightPos: 0, merged: [], op },
        highlights,
        _logEntry: { type: 'action', text: `P${action.playerNum}: Merging [${leftCards.map(c => c.value)}] + [${rightCards.map(c => c.value)}].` },
      };
    }

    case 'MERGE_SETUP_COMPARE': {
      if (state.mergePhase !== 'comparing' || !state.mergeState) return state;
      const { leftCards, rightCards, leftPos, rightPos } = state.mergeState;
      if (leftPos >= leftCards.length || rightPos >= rightCards.length) return state;
      const leftVal = leftCards[leftPos].value;
      const rightVal = rightCards[rightPos].value;
      const takeLeft = leftVal <= rightVal;
      return {
        ...state,
        pendingAction: { type: 'merge_compare', leftVal, rightVal, takeLeft },
      };
    }

    case 'MERGE_EXECUTE': {
      if (!state.pendingAction || state.pendingAction.type !== 'merge_compare') return state;
      const { leftVal, rightVal, takeLeft } = state.pendingAction;
      const correct = action.takeLeft === takeLeft;
      if (!correct) {
        return {
          ...state,
          penalties: state.penalties + 1,
          pendingAction: null,
          _logEntry: { type: 'penalty', text: `P${action.playerNum}: Wrong merge call: ${leftVal} vs ${rightVal}.` },
        };
      }
      const ms = { ...state.mergeState };
      const newComparisons = state.comparisons + 1;
      const newSwaps = state.swaps + 1;
      const merged = [...ms.merged];
      let { leftPos, rightPos } = ms;
      if (takeLeft) {
        merged.push(ms.leftCards[leftPos]);
        leftPos++;
      } else {
        merged.push(ms.rightCards[rightPos]);
        rightPos++;
      }
      const logEntry = { type: 'action', text: `P${action.playerNum}: ${leftVal} vs ${rightVal} → take ${takeLeft ? leftVal : rightVal}.` };

      // Check if one side exhausted
      const leftDone = leftPos >= ms.leftCards.length;
      const rightDone = rightPos >= ms.rightCards.length;
      if (leftDone || rightDone) {
        // Append remaining
        const remaining = leftDone
          ? ms.rightCards.slice(rightPos)
          : ms.leftCards.slice(leftPos);
        const finalMerged = [...merged, ...remaining];
        // Write back to lane
        const { op } = ms;
        let newLane = [...state.lane];
        for (let i = 0; i < finalMerged.length; i++) {
          newLane[op.start + i] = { ...finalMerged[i] };
        }
        const nextOpIdx = state.currentMergeOpIdx + 1;
        const allDone = nextOpIdx >= state.mergeOps.length;
        const logEntries = [logEntry];
        if (remaining.length > 0) {
          logEntries.push({ type: 'action', text: `P${action.playerNum}: Append remaining [${remaining.map(c => c.value)}].` });
        }
        logEntries.push({ type: 'lock', text: `P${action.playerNum}: Merge complete → [${finalMerged.map(c => c.value)}].` });
        if (allDone) {
          newLane = newLane.map(c => ({ ...c, locked: true }));
          logEntries.push({ type: 'done', text: `P${action.playerNum} finished: ${newComparisons} comp, ${newSwaps} moves.` });
        }
        return {
          ...state,
          lane: newLane,
          comparisons: newComparisons,
          swaps: newSwaps,
          currentMergeOpIdx: nextOpIdx,
          mergeState: null,
          mergePhase: allDone ? 'done' : 'start_merge',
          highlights: {},
          pendingAction: null,
          finished: allDone,
          _logEntries: logEntries,
        };
      }
      return {
        ...state,
        comparisons: newComparisons,
        swaps: newSwaps,
        mergeState: { ...ms, leftPos, rightPos, merged },
        pendingAction: null,
        _logEntry: logEntry,
      };
    }

    // ====== HEAP SORT ======
    case 'HEAP_SETUP_COMPARE': {
      if (state.finished || state.school !== 'heap') return state;
      let pos;
      if (state.heapPhase === 'building') {
        pos = state.siftPos !== null ? state.siftPos : state.heapBuildIdx;
      } else if (state.heapPhase === 'extract_sift') {
        pos = state.siftPos !== null ? state.siftPos : 0;
      } else return state;

      const sz = state.heapSize;
      const left = 2 * pos + 1;
      const right = 2 * pos + 2;
      if (left >= sz) {
        // No children — sift done at this level
        if (state.heapPhase === 'building') {
          const nextBuild = state.heapBuildIdx - 1;
          if (nextBuild < 0) {
            return { ...state, heapPhase: 'extract_swap', siftPos: null, siftState: null, highlights: {} };
          }
          return { ...state, heapBuildIdx: nextBuild, siftPos: null, siftState: null, highlights: {} };
        }
        return { ...state, heapPhase: 'extract_swap', siftPos: null, siftState: null, highlights: {} };
      }
      // Find largest child
      let maxChild = left;
      let compsNeeded = 1;
      if (right < sz) {
        compsNeeded = 2;
        if (state.lane[right].value > state.lane[left].value) maxChild = right;
      }
      const parentVal = state.lane[pos].value;
      const childVal = state.lane[maxChild].value;
      const shouldSwap = childVal > parentVal;
      const highlights = { [pos]: 'pivot' };
      if (left < sz) highlights[left] = 'compare_left';
      if (right < sz) highlights[right] = 'compare_right';
      return {
        ...state,
        siftPos: pos,
        siftState: 'comparing',
        highlights,
        pendingAction: { type: 'heap_compare', parentIdx: pos, parentVal, childIdx: maxChild, childVal, shouldSwap, compsNeeded },
      };
    }

    case 'HEAP_EXECUTE': {
      if (!state.pendingAction || state.pendingAction.type !== 'heap_compare') return state;
      const { parentIdx, parentVal, childIdx, childVal, shouldSwap, compsNeeded } = state.pendingAction;
      const correct = action.swap === shouldSwap;
      if (!correct) {
        return {
          ...state,
          penalties: state.penalties + 1,
          highlights: {},
          pendingAction: null,
          siftState: null,
          _logEntry: { type: 'penalty', text: `P${action.playerNum}: Wrong call on ${parentVal} vs ${childVal}.` },
        };
      }
      const newComparisons = state.comparisons + compsNeeded;
      let newSwaps = state.swaps;
      let newLane = [...state.lane];
      const logEntries = [];

      if (shouldSwap) {
        [newLane[parentIdx], newLane[childIdx]] = [newLane[childIdx], newLane[parentIdx]];
        newSwaps += 1;
        logEntries.push({ type: 'action', text: `P${action.playerNum}: ${childVal} > ${parentVal} → swap.` });
        // Continue sifting at childIdx
        return {
          ...state,
          lane: newLane,
          comparisons: newComparisons,
          swaps: newSwaps,
          siftPos: childIdx,
          siftState: null,
          highlights: {},
          pendingAction: null,
          _logEntries: logEntries,
        };
      } else {
        logEntries.push({ type: 'action', text: `P${action.playerNum}: ${parentVal} ≥ ${childVal} → stays.` });
        // Sift done
        if (state.heapPhase === 'building') {
          const nextBuild = state.heapBuildIdx - 1;
          if (nextBuild < 0) {
            logEntries.push({ type: 'lock', text: `P${action.playerNum}: Max-heap built!` });
            return {
              ...state, lane: newLane, comparisons: newComparisons, swaps: newSwaps,
              heapPhase: 'extract_swap', heapBuildIdx: -1, siftPos: null, siftState: null,
              highlights: {}, pendingAction: null, _logEntries: logEntries,
            };
          }
          return {
            ...state, lane: newLane, comparisons: newComparisons, swaps: newSwaps,
            heapBuildIdx: nextBuild, siftPos: null, siftState: null,
            highlights: {}, pendingAction: null, _logEntries: logEntries,
          };
        }
        // extract_sift done
        return {
          ...state, lane: newLane, comparisons: newComparisons, swaps: newSwaps,
          heapPhase: 'extract_swap', siftPos: null, siftState: null,
          highlights: {}, pendingAction: null, _logEntries: logEntries,
        };
      }
    }

    case 'HEAP_EXTRACT': {
      if (state.heapPhase !== 'extract_swap') return state;
      const sz = state.heapSize;
      if (sz <= 1) {
        const finalLane = state.lane.map(c => ({ ...c, locked: true }));
        return {
          ...state, lane: finalLane, heapPhase: 'done', heapSize: 0,
          highlights: {}, finished: true,
          _logEntries: [{ type: 'done', text: `P${action.playerNum} finished: ${state.comparisons} comp, ${state.swaps} swap.` }],
        };
      }
      let newLane = [...state.lane];
      const lastIdx = sz - 1;
      [newLane[0], newLane[lastIdx]] = [newLane[lastIdx], newLane[0]];
      newLane[lastIdx] = { ...newLane[lastIdx], locked: true };
      const newSize = sz - 1;
      const logEntries = [
        { type: 'action', text: `P${action.playerNum}: Extract max ${newLane[lastIdx].value} → position ${sz}.` },
        { type: 'lock', text: `P${action.playerNum}: Locked ${newLane[lastIdx].value}.` },
      ];
      if (newSize <= 1) {
        newLane[0] = { ...newLane[0], locked: true };
        logEntries.push({ type: 'done', text: `P${action.playerNum} finished: ${state.comparisons} comp, ${state.swaps + 1} swap.` });
        return {
          ...state, lane: newLane, swaps: state.swaps + 1,
          heapPhase: 'done', heapSize: 0, siftPos: null, siftState: null,
          highlights: {}, pendingAction: null, finished: true, _logEntries: logEntries,
        };
      }
      return {
        ...state, lane: newLane, swaps: state.swaps + 1,
        heapPhase: 'extract_sift', heapSize: newSize, siftPos: 0, siftState: null,
        highlights: {}, pendingAction: null, _logEntries: logEntries,
      };
    }

    // ====== RADIX SORT ======
    case 'RADIX_PLACE': {
      if (state.finished || state.school !== 'radix' || state.radixPhase !== 'placing') return state;
      const card = state.lane[state.radixCardIdx];
      const digitFn = state.radixPass === 0 ? (v) => v % 10 : (v) => Math.floor(v / 10) % 10;
      const correctBucket = digitFn(card.value);
      const correct = action.bucket === correctBucket;
      if (!correct) {
        return {
          ...state,
          penalties: state.penalties + 1,
          _logEntry: { type: 'penalty', text: `P${action.playerNum}: Wrong bucket for ${card.value} (chose ${action.bucket}, correct: ${correctBucket}).` },
        };
      }
      const newBuckets = state.radixBuckets.map((b, i) => i === correctBucket ? [...b, card] : [...b]);
      const newComps = state.comparisons + 1; // count placements
      const nextIdx = state.radixCardIdx + 1;
      const logEntry = { type: 'action', text: `P${action.playerNum}: ${card.value} → bucket ${correctBucket}.` };
      if (nextIdx >= state.lane.length) {
        // All placed, collect
        return {
          ...state, comparisons: newComps, radixBuckets: newBuckets,
          radixCardIdx: nextIdx, radixPhase: 'collecting',
          highlights: {}, pendingAction: null, _logEntry: logEntry,
        };
      }
      return {
        ...state, comparisons: newComps, radixBuckets: newBuckets,
        radixCardIdx: nextIdx, highlights: { [nextIdx]: 'compare' },
        pendingAction: null, _logEntry: logEntry,
      };
    }

    case 'RADIX_COLLECT': {
      if (state.radixPhase !== 'collecting') return state;
      const collected = state.radixBuckets.flat();
      const newLane = collected.map((c, i) => ({ ...c, id: i }));
      const nextPass = state.radixPass + 1;
      if (nextPass >= 2) {
        const finalLane = newLane.map(c => ({ ...c, locked: true }));
        return {
          ...state, lane: finalLane, radixPass: nextPass,
          radixPhase: 'done', radixBuckets: Array.from({ length: 10 }, () => []),
          radixCardIdx: 0, highlights: {}, finished: true,
          _logEntries: [
            { type: 'lock', text: `P${action.playerNum}: Collected from buckets — sorted!` },
            { type: 'done', text: `P${action.playerNum} finished: ${state.comparisons} placements, ${state.penalties} penalties.` },
          ],
        };
      }
      return {
        ...state, lane: newLane, radixPass: nextPass,
        radixPhase: 'placing', radixBuckets: Array.from({ length: 10 }, () => []),
        radixCardIdx: 0, highlights: { [0]: 'compare' },
        _logEntries: [
          { type: 'lock', text: `P${action.playerNum}: Collected from buckets. Starting tens digit pass.` },
        ],
      };
    }

    case 'CANCEL_PENDING':
      return {
        ...state,
        highlights: state.pendingAction?.type === 'quick_compare'
          ? { ...state.highlights, [state.pendingAction.cardIdx]: 'compare' }
          : {},
        pendingAction: null,
      };

    default:
      return state;
  }
}

function rootReducer(state, action) {
  if (action.type === 'RESET') {
    const school = action.school || state.players[0].school || 'bubble';
    return initialState(school, action.mode || state.mode, action.deckSize || state.deckSize || 8);
  }

  const pIdx = 0;
  const newPlayer = playerReducer(state.players[pIdx], { ...action, playerNum: pIdx + 1 });
  const newPlayers = [...state.players];
  newPlayers[pIdx] = newPlayer;

  let newLog = state.log;
  if (newPlayer._logEntry) {
    newLog = [...newLog, newPlayer._logEntry];
    delete newPlayer._logEntry;
  }
  if (newPlayer._logEntries) {
    newLog = [...newLog, ...newPlayer._logEntries];
    delete newPlayer._logEntries;
  }

  return { ...state, players: newPlayers, log: newLog };
}

// ============================================================================
// DESIGN SYSTEM
// ============================================================================

const C = {
  cream: '#F4EBD6',
  paper: '#FBF6EA',
  parchment: '#EADFC2',
  gold: '#C9A227',
  ink: '#1A1A1A',
  crimson: '#A8322B',
  emerald: '#2E7D5B',
  cobalt: '#2C4A7F',
  violet: '#5E3B7A',
  slate: '#4A4A4A',
  teal: '#1A7A6D',
  soft: '#6B6B6B',
  rule: '#D4C9AC',
  dark: '#0E0E0E',
};

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: ${C.cream}; color: ${C.ink}; font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; overflow-x: hidden; }

    .font-serif { font-family: 'Cormorant Garamond', Georgia, serif; }
    .font-sans { font-family: 'Inter', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', Menlo, monospace; }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes pulseGold {
      0%, 100% { box-shadow: 0 0 0 0 rgba(201, 162, 39, 0); }
      50% { box-shadow: 0 0 0 6px rgba(201, 162, 39, 0.35); }
    }
    @keyframes pulseCobalt {
      0%, 100% { box-shadow: 0 0 0 0 rgba(44, 74, 127, 0); }
      50% { box-shadow: 0 0 0 6px rgba(44, 74, 127, 0.35); }
    }
    @keyframes shimmer {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
    @keyframes scrollMarquee {
      from { transform: translateX(0); }
      to { transform: translateX(-50%); }
    }

    .grain-bg {
      background-image:
        radial-gradient(ellipse at 20% 10%, rgba(201, 162, 39, 0.05) 0%, transparent 50%),
        radial-gradient(ellipse at 85% 90%, rgba(168, 50, 43, 0.04) 0%, transparent 50%);
    }
    .grain-bg::before {
      content: '';
      position: fixed; inset: 0;
      pointer-events: none; z-index: 0;
      background-image:
        repeating-conic-gradient(from 0deg, rgba(0,0,0,0.008) 0%, transparent 0.5%, transparent 1%);
      mix-blend-mode: multiply;
    }

    .dragon-card-interactive { transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease; }
    .dragon-card-interactive:hover { transform: translateY(-3px); }

    .link-underline { position: relative; }
    .link-underline::after {
      content: ''; position: absolute; bottom: -2px; left: 0;
      width: 100%; height: 1px; background: currentColor;
      transform: scaleX(0); transform-origin: right;
      transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .link-underline:hover::after { transform: scaleX(1); transform-origin: left; }

    .subtle-scroll::-webkit-scrollbar { width: 6px; }
    .subtle-scroll::-webkit-scrollbar-track { background: transparent; }
    .subtle-scroll::-webkit-scrollbar-thumb { background: ${C.rule}; border-radius: 3px; }

    button { font-family: inherit; }

    /* Mobile responsiveness */
    @media (max-width: 768px) {
      .hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
      .hero-visual { display: none !important; }
      .hero-h1 { font-size: 48px !important; }
      .hero-section { min-height: auto !important; padding: 40px 16px 60px !important; }
      .nav-inner { padding: 12px 16px !important; }
      .nav-links { display: none !important; }
      .section-padding { padding: 48px 16px !important; }
      .stat-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
      .stat-number { font-size: 36px !important; }
      .steps-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
      .step-card { padding: 24px !important; }
      .schools-grid { grid-template-columns: repeat(3, 1fr) !important; }
      .school-cell { padding: 12px 8px !important; }
      .school-symbol { font-size: 20px !important; }
      .school-name-cell { font-size: 12px !important; }
      .setup-container { padding: 24px 16px !important; }
      .mode-grid { grid-template-columns: 1fr !important; }
      .school-select-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
      .difficulty-row { flex-wrap: wrap !important; }
      .difficulty-row > button { flex: 1 1 40% !important; }
      .howto-box { padding: 16px 12px !important; }
      .player-panel { padding: 12px !important; }
      .stats-row { flex-wrap: wrap !important; gap: 8px !important; }
      .stats-row > div { min-width: auto !important; flex: 1 1 auto !important; }
      .serif-desc { font-size: 16px !important; max-width: 100% !important; }
      .section-heading { font-size: 28px !important; }
      .section-subhead { font-size: 24px !important; }
    }
    @media (max-width: 480px) {
      .hero-h1 { font-size: 36px !important; }
      .schools-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .school-select-grid { grid-template-columns: 1fr !important; }
    }
  `}</style>
);

// ============================================================================
// SHARED VISUAL COMPONENTS
// ============================================================================

const DragonCard = ({ value, locked, highlight, compact = false, size, mobile = false, fluid = false }) => {
  const barHeight = Math.max(0.1, Math.min(1, value / 50));
  const suitColor =
    value <= 10 ? C.cobalt :
    value <= 25 ? C.emerald :
    value <= 40 ? C.violet : C.crimson;

  const bg = locked ? C.gold : C.cream;
  const border =
    highlight === 'pivot' ? C.gold :
    (highlight === 'compare' || highlight === 'compare_left' || highlight === 'compare_right') ? C.cobalt :
    highlight === 'blue' ? C.cobalt :
    highlight === 'red' ? C.crimson : C.ink;

  const pulseAnim =
    highlight === 'pivot' ? 'pulseGold 1.6s ease-in-out infinite' :
    (highlight === 'compare' || highlight === 'compare_left' || highlight === 'compare_right') ? 'pulseCobalt 1.3s ease-in-out infinite' :
    'none';

  const tintOverlay =
    highlight === 'blue' ? 'rgba(44, 74, 127, 0.15)' :
    highlight === 'red' ? 'rgba(168, 50, 43, 0.12)' : 'transparent';

  // Fluid mode: card fills container, uses aspect-ratio
  if (fluid) {
    return (
      <div className="dragon-card-interactive" style={{
        width: '100%', aspectRatio: '5 / 7', background: bg, borderRadius: 5,
        border: `${highlight ? 2 : 1}px solid ${border}`,
        position: 'relative', overflow: 'hidden',
        boxShadow: locked
          ? '0 2px 8px rgba(201, 162, 39, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.3)'
          : '0 1px 3px rgba(0, 0, 0, 0.08)',
        animation: pulseAnim, transition: 'all 0.3s ease',
      }}>
        {tintOverlay !== 'transparent' && (
          <div style={{ position: 'absolute', inset: 0, background: tintOverlay, pointerEvents: 'none' }} />
        )}
        <div style={{
          position: 'absolute', left: '5%', bottom: '5%', width: '8%',
          height: `calc(${barHeight * 100}% - 10%)`,
          background: C.ink, opacity: 0.85,
        }} />
        <div className="font-serif" style={{
          position: 'absolute', top: '5%', right: '8%',
          fontWeight: 700, fontSize: 'clamp(12px, 3.5cqi, 30px)', color: C.ink, letterSpacing: '-0.02em',
        }}>
          {value}
        </div>
        <div style={{
          position: 'absolute', bottom: '6%', right: '8%',
          width: 'clamp(7px, 2cqi, 12px)', height: 'clamp(7px, 2cqi, 12px)',
          borderRadius: '50%', border: `2px solid ${suitColor}`,
        }} />
        {locked && (
          <div className="font-sans" style={{
            position: 'absolute', bottom: '5%', left: '22%',
            fontSize: 'clamp(5px, 1.2cqi, 7px)', fontWeight: 600,
            letterSpacing: '0.1em', color: C.ink, opacity: 0.7,
          }}>
            LOCKED
          </div>
        )}
      </div>
    );
  }

  const s = size || (mobile ? { w: 38, h: 54, fs: 14, bar: 5 } : (compact ? { w: 64, h: 90, fs: 24, bar: 9 } : { w: 80, h: 112, fs: 30, bar: 11 }));

  return (
    <div className="dragon-card-interactive" style={{
      width: s.w, height: s.h, background: bg, borderRadius: 5,
      border: `${highlight ? 2 : 1}px solid ${border}`,
      position: 'relative', overflow: 'hidden',
      boxShadow: locked
        ? '0 2px 8px rgba(201, 162, 39, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.3)'
        : '0 1px 3px rgba(0, 0, 0, 0.08)',
      animation: pulseAnim, transition: 'all 0.3s ease',
    }}>
      {tintOverlay !== 'transparent' && (
        <div style={{ position: 'absolute', inset: 0, background: tintOverlay, pointerEvents: 'none' }} />
      )}
      <div style={{
        position: 'absolute', left: 3, bottom: 3, width: s.bar,
        height: `calc(${barHeight * 100}% - 6px)`,
        background: C.ink, opacity: 0.85,
      }} />
      <div className="font-serif" style={{
        position: 'absolute', top: 4, right: 6,
        fontWeight: 700, fontSize: s.fs, color: C.ink, letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
      <div style={{
        position: 'absolute', bottom: 4, right: 6,
        width: compact ? 9 : 12, height: compact ? 9 : 12,
        borderRadius: '50%', border: `2px solid ${suitColor}`,
      }} />
      {locked && (
        <div className="font-sans" style={{
          position: 'absolute', bottom: 3, left: compact ? 14 : 18,
          fontSize: compact ? 6 : 7, fontWeight: 600,
          letterSpacing: '0.1em', color: C.ink, opacity: 0.7,
        }}>
          LOCKED
        </div>
      )}
    </div>
  );
};

const Lane = ({ lane, highlights, onCardClick, clickablePredicate, compact, showIndex = true }) => {
  const mobile = useIsMobile(768);
  return (
    <div className="lane-row" style={{ display: 'flex', gap: 'clamp(2px, 0.5vw, 6px)', justifyContent: 'center', flexWrap: 'nowrap', containerType: 'inline-size', maxWidth: 900, margin: '0 auto' }}>
      {lane.map((card, idx) => {
        const highlight = highlights[idx];
        const clickable = clickablePredicate ? clickablePredicate(idx, card) : false;
        return (
          <div
            key={card.id}
            onClick={clickable ? () => onCardClick(idx) : undefined}
            style={{
              position: 'relative', cursor: clickable ? 'pointer' : 'default',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: mobile ? 2 : 3, flex: '1 1 0', minWidth: 0,
            }}
          >
            <DragonCard value={card.value} locked={card.locked} highlight={highlight} fluid />
            {showIndex && (
              <span className="font-sans" style={{ fontSize: 'clamp(6px, 1.2vw, 9px)', color: C.soft, letterSpacing: '0.08em' }}>
                {idx + 1}
              </span>
            )}
            {clickable && (
              <div style={{
                position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
                fontSize: mobile ? 10 : 14, color: C.gold,
                animation: 'shimmer 1.2s ease-in-out infinite',
              }}>▼</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const Eyebrow = ({ children, color = C.soft }) => (
  <div className="font-mono" style={{
    fontSize: 10, color, letterSpacing: '0.25em',
    textTransform: 'uppercase', fontWeight: 500,
  }}>{children}</div>
);

const SerifHeading = ({ children, size = 36, color = C.ink, italic = false, className = '' }) => (
  <h2 className={`font-serif ${className}`} style={{
    fontSize: size, fontWeight: 500, color, margin: 0,
    letterSpacing: '-0.02em', lineHeight: 1.05,
    fontStyle: italic ? 'italic' : 'normal',
  }}>{children}</h2>
);

const DecorativeRule = ({ color = C.gold, width = 80, thick = false }) => (
  <div style={{
    height: thick ? 2 : 1, width, background: color,
  }} />
);

const Button = ({ children, onClick, variant = 'primary', disabled, small = false, fullWidth = false }) => {
  const [hover, setHover] = useState(false);
  const bases = {
    primary: {
      bg: hover && !disabled ? C.cream : C.ink,
      color: hover && !disabled ? C.ink : C.cream,
      border: `1px solid ${C.ink}`,
    },
    inverse: {
      bg: hover && !disabled ? C.ink : C.cream,
      color: hover && !disabled ? C.cream : C.ink,
      border: `1px solid ${C.ink}`,
    },
    secondary: {
      bg: hover && !disabled ? C.ink : 'transparent',
      color: hover && !disabled ? C.cream : C.ink,
      border: `1px solid ${C.ink}`,
    },
    gold: {
      bg: C.gold,
      color: C.ink,
      border: `1px solid ${C.gold}`,
    },
    swap: {
      bg: C.crimson, color: C.cream, border: `1px solid ${C.crimson}`,
    },
    keep: {
      bg: C.emerald, color: C.cream, border: `1px solid ${C.emerald}`,
    },
    ghost: {
      bg: hover && !disabled ? C.rule : 'transparent',
      color: C.ink, border: '1px solid transparent',
    },
  };
  const s = bases[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: small ? '7px 14px' : '11px 22px',
        background: s.bg, color: s.color, border: s.border,
        borderRadius: 2, fontSize: small ? 11 : 12, fontWeight: 500,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1, transition: 'all 0.2s ease',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      {children}
    </button>
  );
};

// ============================================================================
// LANDING PAGE SECTIONS
// ============================================================================

const Nav = ({ onPlayClick }) => (
  <nav style={{
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    background: 'rgba(244, 235, 214, 0.92)',
    backdropFilter: 'blur(8px)',
    borderBottom: `1px solid ${C.rule}`,
  }}>
    <div className="nav-inner" style={{
      maxWidth: 1280, margin: '0 auto', padding: '18px 32px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <div className="font-serif" style={{
          fontSize: 22, fontWeight: 600, color: C.ink, letterSpacing: '-0.01em',
        }}>
          Stack Attack
        </div>
        <div className="font-mono" style={{ fontSize: 9, color: C.soft, letterSpacing: '0.2em' }}>
          EST. 2026
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <span className="nav-links" style={{ display: 'contents' }}>{['The Game', 'How it Works'].map(link => (
          <a
            key={link}
            href={`#${link.toLowerCase().replace(/\s/g, '-')}`}
            className="link-underline font-sans"
            style={{
              fontSize: 12, color: C.ink, textDecoration: 'none',
              letterSpacing: '0.05em', fontWeight: 500,
            }}
          >
            {link}
          </a>
        ))}</span>
        <Button small onClick={onPlayClick}>Play Now</Button>
      </div>
    </div>
  </nav>
);

const Hero = ({ onPlayClick }) => (
  <section className="hero-section" style={{
    minHeight: '88vh', display: 'flex', alignItems: 'center',
    padding: '80px 32px 120px', position: 'relative',
  }}>
    <div style={{ maxWidth: 1280, margin: '0 auto', width: '100%' }}>
      <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 80, alignItems: 'center' }}>
        <div style={{ animation: 'fadeUp 0.8s ease-out' }}>
          <Eyebrow color={C.gold}>A Board Game That Teaches Algorithms</Eyebrow>
          <h1 className="font-serif hero-h1" style={{
            fontSize: 108, fontWeight: 500, color: C.ink, lineHeight: 0.95,
            letterSpacing: '-0.03em', margin: '24px 0 32px',
          }}>
            Tame the<br/>
            <span style={{ fontStyle: 'italic', color: C.crimson }}>chaos.</span><br/>
            Order the<br/>
            <span style={{ fontStyle: 'italic', color: C.gold }}>dragons.</span>
          </h1>
          <p className="font-serif serif-desc" style={{
            fontSize: 22, color: C.slate, lineHeight: 1.5,
            maxWidth: 540, fontStyle: 'italic', marginBottom: 40,
          }}>
            A tabletop game where rival apprentices learn sorting algorithms by
            doing — not by reading. Played by middle schoolers. Loved by their parents.
          </p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Button onClick={onPlayClick}>Play Now</Button>
            <a href="#how-it-works" style={{
              fontFamily: 'Inter, sans-serif', fontSize: 12, color: C.ink,
              letterSpacing: '0.15em', textTransform: 'uppercase', textDecoration: 'none',
              fontWeight: 500,
            }} className="link-underline">
              How it works →
            </a>
          </div>

        </div>
        {/* Hero visual: floating dragon cards */}
        <div className="hero-visual" style={{ position: 'relative', height: 560, animation: 'fadeIn 1.2s ease-out' }}>
          {[
            { v: 41, x: 0, y: 40, rot: -6, z: 1 },
            { v: 17, x: 100, y: 0, rot: 4, z: 2 },
            { v: 3, x: 200, y: 100, rot: -2, z: 3 },
            { v: 22, x: 40, y: 200, rot: 8, z: 1 },
            { v: 8, x: 180, y: 260, rot: -5, z: 2 },
            { v: 33, x: 60, y: 360, rot: 3, z: 1 },
          ].map((card, i) => (
            <div
              key={i}
              style={{
                position: 'absolute', top: card.y, left: card.x,
                transform: `rotate(${card.rot}deg)`,
                zIndex: card.z,
                animation: `fadeUp 0.8s ease-out ${0.2 + i * 0.1}s backwards`,
              }}
            >
              <DragonCard value={card.v} size={{ w: 140, h: 200, fs: 48, bar: 16 }} />
            </div>
          ))}

        </div>
      </div>
    </div>
  </section>
);

const ProblemSection = () => (
  <section className="section-padding" style={{ padding: '120px 32px', background: C.paper, borderTop: `1px solid ${C.rule}`, borderBottom: `1px solid ${C.rule}` }}>
    <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
      <Eyebrow>The Problem</Eyebrow>
      <SerifHeading size={54}>
        <span className="section-heading">Algorithms are famously <span style={{ fontStyle: 'italic' }}>boring</span> to learn.</span>
      </SerifHeading>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
        <DecorativeRule width={120} />
      </div>
      <p className="font-serif serif-desc" style={{
        fontSize: 22, color: C.slate, lineHeight: 1.6, marginTop: 36,
        maxWidth: 720, margin: '36px auto 0',
      }}>
        Most textbooks teach with pseudocode. Most videos teach with animation. Most
        students memorize terms and forget them by Thursday. There{"'"}s a better way:
        <span style={{ color: C.ink, fontStyle: 'italic' }}>&nbsp;make the student become the process.</span>
      </p>
      <div className="stat-grid" style={{
        marginTop: 80, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 48, textAlign: 'left',
      }}>
        {[
          {
            stat: '2\u00D7',
            label: 'better learning gains',
            body: 'Students who physically act out algorithms score roughly twice as high as those in passive lectures.',
          },
          {
            stat: '28',
            label: 'peer-reviewed studies',
            body: 'A systematic review of hands-on "unplugged" CS activities found positive learning outcomes across every age group.',
          },
          {
            stat: '4+',
            label: 'years of classroom evidence',
            body: 'Multi-year trials confirm that embodied, technology-enhanced learning significantly improves retention and memory.',
          },
        ].map((item, i) => (
          <div key={i}>
            <div className="font-serif stat-number" style={{
              fontSize: 64, fontWeight: 500, color: C.crimson,
              letterSpacing: '-0.03em', lineHeight: 1,
            }}>
              {item.stat}
            </div>
            <div className="font-mono" style={{
              fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
              color: C.soft, marginTop: 12,
            }}>
              {item.label}
            </div>
            <p className="font-sans" style={{
              fontSize: 14, color: C.slate, lineHeight: 1.6, marginTop: 12,
            }}>
              {item.body}
            </p>
          </div>
        ))}
      </div>
      <div className="font-mono" style={{ fontSize: 9, color: C.soft, marginTop: 48, letterSpacing: '0.1em', lineHeight: 1.8 }}>
        Sources: Johnson-Glenberg et al. (2014) <span style={{ fontStyle: 'italic' }}>J. Educational Psychology</span>, 502 citations ·
        Battal &amp; Afacan Adanır (2021) <span style={{ fontStyle: 'italic' }}>J. Educational Technology &amp; Society</span>, 76 citations ·
        Kosmas &amp; Zaphiris (2023) <span style={{ fontStyle: 'italic' }}>Education &amp; Information Technologies</span>, 52 citations
      </div>
    </div>
  </section>
);

const HowItWorks = () => (
  <section id="how-it-works" className="section-padding" style={{ padding: '120px 32px' }}>
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 80 }}>
        <Eyebrow>How it Works</Eyebrow>
        <SerifHeading size={54} className="section-heading">Three moves. Seven schools. One kingdom.</SerifHeading>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <DecorativeRule width={120} />
        </div>
      </div>

      <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
        {[
          {
            num: '01',
            title: 'Choose your school',
            body: "Bubble Monks sort patiently by comparing neighbors. Quick Order partitions aggressively around a pivot. Merge Guild splits and recombines. Each School teaches one sorting algorithm — physically, in your hands.",
            color: C.gold,
          },
          {
            num: '02',
            title: 'Execute one primitive per turn',
            body: 'Every turn is one atomic action from your School: one comparison, one swap, one partition step. Tick your tally strip after every move. The strip is simultaneously your scorecard and your Big-O demonstration.',
            color: C.crimson,
          },
          {
            num: '03',
            title: 'Win by elegance, not speed',
            body: "The Efficiency Medal doesn't reward who finishes first. It rewards who comes closest to their algorithm's theoretical minimum. A well-played Bubble Sort beats a sloppy Quick Sort — and that's the lesson.",
            color: C.emerald,
          },
        ].map((step, i) => (
          <div key={i} className="step-card" style={{
            background: C.paper, border: `1px solid ${C.rule}`,
            padding: 40, position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: -1, left: -1,
              width: 40, height: 40, borderColor: step.color,
              borderStyle: 'solid', borderWidth: 0,
              borderTopWidth: 3, borderLeftWidth: 3,
            }} />
            <div className="font-mono" style={{
              fontSize: 11, color: step.color, letterSpacing: '0.2em',
              fontWeight: 600, marginBottom: 20,
            }}>
              STEP {step.num}
            </div>
            <SerifHeading size={28}>{step.title}</SerifHeading>
            <p className="font-sans" style={{
              fontSize: 14, color: C.slate, lineHeight: 1.7, marginTop: 16,
            }}>
              {step.body}
            </p>
          </div>
        ))}
      </div>

      {/* Seven schools preview */}
      <div style={{ marginTop: 100 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Eyebrow>The Seven Schools</Eyebrow>
          <SerifHeading size={40} className="section-subhead" italic>Each one an algorithm. Each one a strategy.</SerifHeading>
        </div>
        <div className="schools-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2,
          border: `1px solid ${C.rule}`, background: C.rule,
        }}>
          {[
            { name: 'Bubble Monks', symbol: '◯', complexity: 'O(n²)', color: C.gold },
            { name: 'Quick Order', symbol: '◇', complexity: 'O(n log n)', color: C.crimson },
            { name: 'Merge Guild', symbol: '▽▽', complexity: 'O(n log n)', color: C.cobalt },
            { name: 'Insertion', symbol: '◨', complexity: 'O(n²)', color: C.emerald },
            { name: 'Selection', symbol: '◐', complexity: 'O(n²)', color: C.violet },
            { name: 'Heap', symbol: '△', complexity: 'O(n log n)', color: C.slate },
            { name: 'Radix', symbol: '◙', complexity: 'O(nk)', color: C.teal },
          ].map((school, i) => (
            <div key={i} className="school-cell" style={{
              background: C.paper, padding: '28px 16px', textAlign: 'center',
            }}>
              <div className="school-symbol" style={{
                fontSize: 28, color: school.color, marginBottom: 10,
              }}>
                {school.symbol}
              </div>
              <div className="font-serif school-name-cell" style={{
                fontSize: 15, fontWeight: 500, color: C.ink, marginBottom: 6,
              }}>
                {school.name}
              </div>
              <div className="font-mono" style={{
                fontSize: 10, color: C.soft, letterSpacing: '0.1em',
              }}>
                {school.complexity}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

// ============================================================================
// EMBEDDED DEMO — the playable game
// ============================================================================

function getTutorialHint(state, activePlayerIdx) {
  const p = state.players[activePlayerIdx];
  if (!p || p.finished) return null;

  // Bubble
  if (p.school === 'bubble') {
    if (p.pendingAction) {
      const { left, right } = p.pendingAction;
      return left > right
        ? `${left} is bigger than ${right} → click "Swap".`
        : `${left} is not bigger than ${right} → click "Keep".`;
    }
    return `Click "Compare Next Pair" to look at the two highlighted cards.`;
  }

  // Quick
  if (p.school === 'quick') {
    if (p.pendingAction) {
      const { cardVal, pivotVal } = p.pendingAction;
      return cardVal < pivotVal
        ? `${cardVal} is less than pivot ${pivotVal} → click "${cardVal} < ${pivotVal}".`
        : `${cardVal} is not less than pivot ${pivotVal} → click "${cardVal} ≥ ${pivotVal}".`;
    }
    if (p.quickPhase === 'choose_pivot') return `Click one of the cards with a ▼ arrow to pick it as your pivot.`;
    if (p.quickPhase === 'comparing') return `Click "Compare Next Card" to check the next card against the pivot.`;
    if (p.quickPhase === 'seal') return `All cards placed! Click "Lock Pivot" to finish this partition.`;
  }

  // Insertion
  if (p.school === 'insertion') {
    if (p.pendingAction && p.pendingAction.type === 'insertion_compare') {
      const { heldVal, cmpVal, shouldShift } = p.pendingAction;
      return shouldShift
        ? `${cmpVal} is bigger than ${heldVal} — it's blocking! Click "Yes… Slide right".`
        : `${heldVal} fits here (≥ ${cmpVal}). Click "No… Drop it here".`;
    }
    return `Click "Compare" to check if your held card fits before the next card.`;
  }

  // Selection
  if (p.school === 'selection') {
    if (p.selectionPhase === 'confirm_swap') {
      const minVal = p.lane[p.selectionMinIdx].value;
      return p.selectionMinIdx !== p.selectionScanStart
        ? `Found smallest: ${minVal}. Click to swap it into position ${p.selectionScanStart + 1}.`
        : `${minVal} is already in the right spot. Click to lock it.`;
    }
    if (p.pendingAction && p.pendingAction.type === 'selection_compare') {
      const { scanVal, minVal, isNewMin } = p.pendingAction;
      return isNewMin
        ? `${scanVal} is smaller than ${minVal} → click "Yes… New Smallest".`
        : `${scanVal} is not smaller → click "No… Keep Looking".`;
    }
    return `Click "Check Next Card" to see if the next card is smaller than your current best.`;
  }

  // Merge
  if (p.school === 'merge') {
    if (p.mergePhase === 'start_merge') {
      const op = p.mergeOps[p.currentMergeOpIdx];
      if (op) {
        const leftVals = p.lane.slice(op.start, op.mid).map(c => c.value);
        const rightVals = p.lane.slice(op.mid, op.end).map(c => c.value);
        return `Click "Compare & Combine" to merge [${leftVals}] and [${rightVals}] into one sorted group.`;
      }
      return `Click "Compare & Combine" to begin.`;
    }
    if (p.pendingAction && p.pendingAction.type === 'merge_compare') {
      const { leftVal, rightVal, takeLeft } = p.pendingAction;
      return takeLeft
        ? `${leftVal} ≤ ${rightVal} — ${leftVal} is smaller, so click "Take ${leftVal}" to add it to the sorted result.`
        : `${rightVal} < ${leftVal} — ${rightVal} is smaller, so click "Take ${rightVal}" to add it to the sorted result.`;
    }
    if (p.mergePhase === 'comparing') return `Click "Which is smaller?" to compare the front card of each group.`;
  }

  // Heap
  if (p.school === 'heap') {
    if (p.pendingAction && p.pendingAction.type === 'heap_compare') {
      const { parentVal, childVal, shouldSwap } = p.pendingAction;
      return shouldSwap
        ? `${childVal} > ${parentVal} — child is larger! Click "Swap down".`
        : `${parentVal} ≥ ${childVal} — parent stays. Click "Stays".`;
    }
    if (p.heapPhase === 'building') return `Click "Check Node" to compare parent with its children.`;
    if (p.heapPhase === 'extract_swap') return `Click "Extract Max" to move the root to its final position.`;
    if (p.heapPhase === 'extract_sift') return `Click "Check Node" to sift the new root down.`;
  }

  // Radix
  if (p.school === 'radix') {
    if (p.radixPhase === 'placing') {
      const card = p.lane[p.radixCardIdx];
      const digit = p.radixPass === 0 ? card.value % 10 : Math.floor(card.value / 10) % 10;
      const digitName = p.radixPass === 0 ? 'ones' : 'tens';
      return `The ${digitName} digit of ${card.value} is ${digit}. Click bucket ${digit}.`;
    }
    if (p.radixPhase === 'collecting') return `Click "Collect from Buckets" to gather cards in order.`;
  }

  return null;
}

const DemoSetup = ({ onStart }) => {
  const [school, setSchool] = useState('bubble');
  const [mode, setMode] = useState('tutorial');
  const [deckSize, setDeckSize] = useState(8);

  const howToPlay = {
    bubble: {
      color: C.gold,
      steps: [
        `You have ${deckSize} cards in a row.`,
        'A pawn moves left to right, comparing each pair of neighbors.',
        'If the left card is bigger → Swap them. Otherwise → Keep.',
        'When the pawn reaches the end, the largest card gets locked on the right.',
        'Repeat passes until every card is locked. Fewer comparisons = higher score!',
      ],
    },
    quick: {
      color: C.crimson,
      steps: [
        `You have ${deckSize} cards in a row.`,
        'Pick one card as your pivot (try to guess the middle value).',
        'Compare each other card against the pivot: smaller → Left, bigger → Right.',
        'When all cards are placed, the pivot locks in its final spot.',
        'Repeat for any unsorted sub-groups until everything is locked.',
      ],
    },
    insertion: {
      color: C.emerald,
      steps: [
        'Card 1 is already "sorted." You pick up card 2.',
        'Compare your held card with the card to its left.',
        'If the left card is bigger, it slides right to make room.',
        'Keep sliding until you find where your card fits, then drop it.',
        'Repeat for each card until the whole row is sorted.',
      ],
    },
    selection: {
      color: C.violet,
      steps: [
        'Scan the entire row to find the smallest card.',
        'Compare each card against your current smallest.',
        'When you reach the end, swap the smallest into position 1 and lock it.',
        'Now scan the remaining cards for the next smallest.',
        'Repeat until every position is filled with the correct card.',
      ],
    },
    merge: {
      color: C.cobalt,
      steps: [
        `Cards start as ${deckSize} individual "groups" of 1.`,
        'Merge pairs of groups: compare the front card of each group.',
        'The smaller card goes into the merged result first.',
        'When one group is empty, append the rest of the other group.',
        'Keep merging bigger groups until the whole row is one sorted group.',
      ],
    },
    heap: {
      color: C.slate,
      steps: [
        'Phase 1: Build a max-heap by sifting nodes down.',
        'At each node, compare parent with its children.',
        'If a child is larger, swap parent down. Repeat until heap is valid.',
        'Phase 2: Extract the max (root) and place it at the end.',
        'Sift the new root down to restore the heap. Repeat until sorted!',
      ],
    },
    radix: {
      color: C.teal,
      steps: [
        'No comparisons! Sort by digits instead.',
        'Pass 1: Place each card into a bucket (0–9) based on its ones digit.',
        'Collect all cards from buckets 0 through 9, left to right.',
        'Pass 2: Repeat using the tens digit.',
        'After both passes, the cards are fully sorted!',
      ],
    },
  };

  const info = howToPlay[school];

  return (
    <div className="setup-container" style={{ padding: '48px 56px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Eyebrow color={C.gold}>Ready to Play</Eyebrow>
        <SerifHeading size={40}>Configure your round</SerifHeading>
        <p className="font-sans" style={{ fontSize: 12, color: C.soft, marginTop: 8 }}>
          Sort random cards with the fewest comparisons to score 100.
        </p>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div className="font-sans" style={{
          fontSize: 11, color: C.soft, letterSpacing: '0.18em',
          textTransform: 'uppercase', marginBottom: 12, fontWeight: 600,
        }}>
          1. Mode
        </div>
        <div className="mode-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {[
            { key: 'tutorial', label: 'Tutorial', desc: 'Hints tell you what to do. For learning.' },
            { key: 'practice', label: 'Solo Practice', desc: 'You decide. Wrong calls = penalty.' },
          ].map(m => (
            <button key={m.key} onClick={() => setMode(m.key)} style={{
              background: mode === m.key ? C.ink : 'transparent',
              color: mode === m.key ? C.cream : C.ink,
              border: `1px solid ${C.ink}`, padding: '14px 16px',
              textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s',
            }}>
              <div className="font-sans" style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{m.label}</div>
              <div className="font-sans" style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.4 }}>{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
          <div className="font-sans" style={{
            fontSize: 11, color: C.soft, letterSpacing: '0.18em',
            textTransform: 'uppercase', marginBottom: 12, fontWeight: 600,
          }}>
            2. School
          </div>
          <div className="school-select-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { key: 'bubble', name: 'Bubble Monks', tagline: 'Patient. Pairwise.', bigO: 'O(n²)', color: C.gold },
              { key: 'quick', name: 'Quick Order', tagline: 'Bold. Partitioning.', bigO: 'O(n log n)', color: C.crimson },
              { key: 'insertion', name: 'Insertion Lodge', tagline: 'Methodical. Shifting.', bigO: 'O(n²)', color: C.emerald },
              { key: 'selection', name: 'Selection Circle', tagline: 'Scanning. Minimal swaps.', bigO: 'O(n²)', color: C.violet },
              { key: 'merge', name: 'Merge Guild', tagline: 'Divide & conquer.', bigO: 'O(n log n)', color: C.cobalt },
              { key: 'heap', name: 'Heap Fortress', tagline: 'Towering. Extracting.', bigO: 'O(n log n)', color: C.slate },
              { key: 'radix', name: 'Radix Alchemists', tagline: 'Digit magic. No comparisons.', bigO: 'O(nk)', color: C.teal },
            ].map(s => (
                <button key={s.key} onClick={() => setSchool(s.key)} style={{
                  background: school === s.key ? C.ink : 'transparent',
                  border: `1px solid ${school === s.key ? s.color : C.rule}`,
                  borderLeft: `4px solid ${s.color}`,
                  padding: '14px 16px', textAlign: 'left', cursor: 'pointer',
                  transition: 'all 0.2s', position: 'relative',
                }}>
                  <div className="font-serif" style={{ fontSize: 18, fontWeight: 500, color: school === s.key ? C.cream : C.ink, marginBottom: 2 }}>{s.name}</div>
                  <div className="font-sans" style={{ fontSize: 11, color: s.color, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 500 }}>{s.tagline}</div>
                  <div style={{ marginTop: 6 }}>
                    <span className="font-mono" style={{ fontSize: 10, color: school === s.key ? C.parchment : C.soft }}>{s.bigO}</span>
                  </div>
                </button>
            ))}
          </div>
        </div>

      {/* Deck size */}
      <div style={{ marginBottom: 32 }}>
        <div className="font-sans" style={{
          fontSize: 11, color: C.soft, letterSpacing: '0.18em',
          textTransform: 'uppercase', marginBottom: 12, fontWeight: 600,
        }}>
          3. Difficulty (cards)
        </div>
        <div className="difficulty-row" style={{ display: 'flex', gap: 10 }}>
          {[
            { n: 6, label: 'Easy', desc: '6 cards' },
            { n: 8, label: 'Normal', desc: '8 cards' },
            { n: 10, label: 'Hard', desc: '10 cards' },
            { n: 12, label: 'Expert', desc: '12 cards' },
          ].map(d => (
            <button key={d.n} onClick={() => setDeckSize(d.n)} style={{
              flex: 1, background: deckSize === d.n ? C.ink : 'transparent',
              color: deckSize === d.n ? C.cream : C.ink,
              border: `1px solid ${C.ink}`, padding: '10px 12px',
              textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
            }}>
              <div className="font-sans" style={{ fontSize: 13, fontWeight: 600 }}>{d.label}</div>
              <div className="font-sans" style={{ fontSize: 10, opacity: 0.7 }}>{d.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* How to Play */}
      <div className="howto-box" style={{
        marginBottom: 32, padding: '20px 24px',
        background: `${info.color}08`, border: `1px solid ${info.color}30`,
        borderLeft: `4px solid ${info.color}`,
      }}>
        <div className="font-mono" style={{
          fontSize: 10, color: info.color, letterSpacing: '0.15em',
          fontWeight: 600, marginBottom: 12,
        }}>
          HOW TO PLAY — {SCHOOL_NAMES[school].toUpperCase()}
        </div>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          {info.steps.map((step, i) => (
            <li key={i} className="font-sans" style={{
              fontSize: 12, color: C.ink, lineHeight: 1.6,
              marginBottom: 4,
            }}>{step}</li>
          ))}
        </ol>
        <div className="font-sans" style={{
          fontSize: 11, color: C.soft, marginTop: 12, fontStyle: 'italic',
        }}>
          💡 Scoring: 100 points if you match the theoretical minimum comparisons. Each extra comparison or wrong call costs points.
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <Button onClick={() => onStart(school, mode, deckSize)}>Begin Round →</Button>
      </div>
    </div>
  );
};

const TallyStrip = ({ label, value, max = 30, color = C.ink }) => {
  const pct = Math.min(1, value / max);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span className="font-sans" style={{
          fontSize: 9, letterSpacing: '0.15em', color: C.soft,
          textTransform: 'uppercase', fontWeight: 500,
        }}>{label}</span>
        <span className="font-mono" style={{ fontSize: 16, fontWeight: 500, color }}>{value}</span>
      </div>
      <div style={{ height: 2, background: C.rule, borderRadius: 1, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct * 100}%`, background: color,
          transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      </div>
    </div>
  );
};

const ActivityLog = ({ log }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 24 }}>
      <button onClick={() => setOpen(!open)} style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6, padding: 0,
      }}>
        <span className="font-sans" style={{
          fontSize: 10, color: C.soft, letterSpacing: '0.18em',
          textTransform: 'uppercase', fontWeight: 600,
        }}>Activity Log ({log.length})</span>
        <span style={{ fontSize: 10, color: C.soft, transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
      </button>
      {open && (
        <div className="subtle-scroll" style={{
          background: C.paper, border: `1px solid ${C.rule}`,
          padding: '12px 16px', maxHeight: 180, overflowY: 'auto',
          fontSize: 11, lineHeight: 1.5, marginTop: 8,
        }}>
          {log.slice().reverse().map((entry, i) => (
            <div key={log.length - 1 - i} className="font-sans" style={{
              padding: '4px 0',
              color: entry.type === 'lock' ? C.gold :
                     entry.type === 'penalty' ? C.crimson :
                     entry.type === 'done' ? C.emerald :
                     entry.type === 'start' ? C.soft : C.ink,
              fontWeight: (entry.type === 'lock' || entry.type === 'done') ? 600 : 400,
            }}>{entry.text}</div>
          ))}
        </div>
      )}
    </div>
  );
};

const PlayerPanel = ({ state, dispatch, playerIdx, activePlayerIdx, mode, scenarioMins, compact }) => {
  const mobile = useIsMobile(768);
  const p = state.players[playerIdx];
  const isActive = playerIdx === activePlayerIdx;
  const theoreticalMin = scenarioMins[p.school];
  const excess = Math.max(0, p.comparisons - theoreticalMin);
  const score = p.finished
    ? Math.max(0, Math.round(100 - (100 * excess / theoreticalMin) - p.penalties * 5))
    : null;

  const playerColor = p.school === 'bubble' ? C.gold : p.school === 'quick' ? C.crimson : p.school === 'insertion' ? C.emerald : p.school === 'selection' ? C.violet : p.school === 'heap' ? C.slate : p.school === 'radix' ? C.teal : C.cobalt;
  const playerName = SCHOOL_NAMES[p.school] || p.school;

  // Partition tray data for Quick
  const showTray = p.school === 'quick' && !p.finished;
  const blueCards = [];
  const redCards = [];
  if (showTray && p.pivotIdx !== null) {
    const [s, e] = p.activeRange;
    for (let i = s; i < e; i++) {
      if (i === p.pivotIdx) continue;
      const h = p.highlights[i];
      if (h === 'blue') blueCards.push(p.lane[i]);
      else if (h === 'red') redCards.push(p.lane[i]);
    }
  }

  return (
    <div className="player-panel" style={{
      border: `1px solid ${C.rule}`,
      padding: 24,
      transition: 'all 0.3s ease',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 16, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <Eyebrow color={playerColor}>{playerName}</Eyebrow>
          {p.finished && (
            <div className="font-mono" style={{
              fontSize: 9, color: C.emerald, letterSpacing: '0.2em',
              marginTop: 4, fontWeight: 600,
            }}>
              ✓ FINISHED · SCORE {score}
            </div>
          )}
        </div>
        <div className="stats-row" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ minWidth: 80 }}>
            <TallyStrip label="Comp" value={p.comparisons} max={Math.max(30, theoreticalMin * 1.5)} />
          </div>
          <div style={{ minWidth: 70 }}>
            <TallyStrip label="Swap" value={p.swaps} max={20} color={C.crimson} />
          </div>
          {p.penalties > 0 && (
            <div style={{ minWidth: 60 }}>
              <TallyStrip label="Pen" value={p.penalties} max={5} color={C.crimson} />
            </div>
          )}
          <div style={{
            paddingLeft: 14, borderLeft: `1px solid ${C.rule}`,
          }}>
            <div className="font-sans" style={{
              fontSize: 9, color: C.soft, letterSpacing: '0.12em',
              textTransform: 'uppercase', fontWeight: 500,
            }}>Theo min</div>
            <div className="font-mono" style={{ fontSize: 16, color: C.ink, fontWeight: 500 }}>{theoreticalMin}</div>
          </div>
        </div>
      </div>

      {/* Iteration tracker */}
      {!p.finished && (() => {
        const n = p.lane.length;
        const locked = p.lane.filter(c => c.locked).length;
        let iterLabel = '';
        let iterDetail = '';
        let iterColor = C.soft;

        if (p.school === 'bubble') {
          const passNum = n - p.passEnd + 1;
          const totalPasses = n - 1;
          const posInPass = p.pawn + 1;
          const passSize = p.passEnd - 1;
          iterLabel = `Pass ${passNum} of ${totalPasses}`;
          iterDetail = `Comparing pair ${posInPass} of ${passSize} · ${locked} card${locked !== 1 ? 's' : ''} locked`;
          iterColor = C.gold;
        } else if (p.school === 'insertion') {
          const cardNum = p.insertionSorted;
          iterLabel = `Inserting card ${cardNum} of ${n - 1}`;
          iterDetail = p.heldCardIdx !== null
            ? `Holding ${p.lane[p.heldCardIdx].value}, scanning left · ${cardNum - 1} card${cardNum - 1 !== 1 ? 's' : ''} sorted`
            : `${cardNum} card${cardNum !== 1 ? 's' : ''} sorted so far`;
          iterColor = C.emerald;
        } else if (p.school === 'selection') {
          const round = p.selectionScanStart + 1;
          iterLabel = `Round ${round} of ${n - 1}`;
          iterDetail = p.selectionPhase === 'confirm_swap'
            ? `Found smallest: ${p.lane[p.selectionMinIdx].value} → ready to place`
            : `Scanning position ${p.selectionScanIdx + 1} · smallest so far: ${p.lane[p.selectionMinIdx].value}`;
          iterColor = C.violet;
        } else if (p.school === 'quick') {
          const depth = p.pendingRanges ? p.pendingRanges.length : 0;
          if (p.quickPhase === 'choose_pivot') {
            const [s, e] = p.activeRange;
            iterLabel = `Partition range [${s + 1}–${e}]`;
            iterDetail = `Pick a pivot · ${locked} card${locked !== 1 ? 's' : ''} locked · ${depth} range${depth !== 1 ? 's' : ''} queued`;
          } else if (p.pivotIdx !== null) {
            const pivotVal = p.lane[p.pivotIdx].value;
            const [s, e] = p.activeRange;
            const done = p.compareIdx !== null ? p.compareIdx - s : 0;
            const total = e - s - 1;
            iterLabel = `Partitioning around ${pivotVal}`;
            iterDetail = `${done} of ${total} cards checked · range [${s + 1}–${e}]`;
          }
          iterColor = C.crimson;
        } else if (p.school === 'merge') {
          const levelInfo = getMergeLevelInfo(p.mergeOps, p.currentMergeOpIdx, p.lane.length);
          iterLabel = levelInfo.shortDesc;
          if (p.mergeState) {
            const merged = p.mergeState.merged.length;
            const total = p.mergeState.op.end - p.mergeState.op.start;
            iterDetail = `Combining: ${merged} of ${total} cards placed`;
          } else {
            iterDetail = `Merge ${levelInfo.opInLevel} of ${levelInfo.opsThisLevel} this pass`;
          }
          iterColor = C.cobalt;
        } else if (p.school === 'heap') {
          if (p.heapPhase === 'building') {
            const total = Math.floor(n / 2);
            const done = total - p.heapBuildIdx;
            iterLabel = `Building heap`;
            iterDetail = `Sifting node ${done} of ${total}`;
          } else {
            iterLabel = `Extracting`;
            iterDetail = `${n - p.heapSize} of ${n - 1} extracted · ${p.heapSize} remaining`;
          }
          iterColor = C.slate;
        } else if (p.school === 'radix') {
          const passName = p.radixPass === 0 ? 'Ones digit' : 'Tens digit';
          iterLabel = `Pass ${p.radixPass + 1} of 2 — ${passName}`;
          iterDetail = p.radixPhase === 'placing'
            ? `Placing card ${p.radixCardIdx + 1} of ${n}`
            : 'Ready to collect';
          iterColor = C.teal;
        }

        return iterLabel ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 12px', marginBottom: 8,
            background: `${iterColor}0A`, borderLeft: `3px solid ${iterColor}`,
          }}>
            <span className="font-mono" style={{
              fontSize: 10, color: iterColor, letterSpacing: '0.1em',
              fontWeight: 600, whiteSpace: 'nowrap',
            }}>{iterLabel}</span>
            <span className="font-sans" style={{
              fontSize: 11, color: C.soft,
            }}>{iterDetail}</span>
          </div>
        ) : null;
      })()}

      {/* Pivot/pawn indicator row */}
      {!p.finished && p.school === 'bubble' && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(2px, 0.5vw, 6px)', marginBottom: 4, maxWidth: 900, margin: '0 auto 4px' }}>
          {p.lane.map((_, idx) => (
            <div key={idx} className="font-mono" style={{
              flex: '1 1 0', minWidth: 0, textAlign: 'center', fontSize: 'clamp(7px, 1.2vw, 9px)',
              color: idx === p.pawn ? C.cobalt : 'transparent',
              letterSpacing: '0.1em', fontWeight: 600,
            }}>▼ PAWN</div>
          ))}
        </div>
      )}
      {!p.finished && p.school === 'quick' && p.pivotIdx !== null && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(2px, 0.5vw, 6px)', marginBottom: 4, maxWidth: 900, margin: '0 auto 4px' }}>
          {p.lane.map((_, idx) => (
            <div key={idx} className="font-mono" style={{
              flex: '1 1 0', minWidth: 0, textAlign: 'center', fontSize: 'clamp(7px, 1.2vw, 9px)',
              color: idx === p.pivotIdx ? C.gold : 'transparent',
              letterSpacing: '0.1em', fontWeight: 600,
            }}>♛ PIVOT</div>
          ))}
        </div>
      )}
      {!p.finished && p.school === 'insertion' && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(2px, 0.5vw, 6px)', marginBottom: 4, maxWidth: 900, margin: '0 auto 4px' }}>
          {p.lane.map((_, idx) => {
            const heldIdx = p.heldCardIdx !== null ? p.heldCardIdx : p.insertionSorted;
            const isHeld = idx === heldIdx;
            const isSorted = idx < p.insertionSorted && !isHeld;
            const isScan = p.scanPos !== null && idx === p.scanPos;
            return (
              <div key={idx} className="font-mono" style={{
                flex: '1 1 0', minWidth: 0, textAlign: 'center', fontSize: 'clamp(7px, 1.2vw, 9px)',
                color: isHeld ? C.emerald : isScan ? C.cobalt : isSorted ? C.soft : 'transparent',
                letterSpacing: '0.1em', fontWeight: 600,
              }}>
                {isHeld ? '▼ HELD' : isSorted ? '✓' : ''}
              </div>
            );
          })}
        </div>
      )}
      {!p.finished && p.school === 'selection' && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(2px, 0.5vw, 6px)', marginBottom: 4, maxWidth: 900, margin: '0 auto 4px' }}>
          {p.lane.map((_, idx) => {
            const isScanStart = idx === p.selectionScanStart;
            const isMin = idx === p.selectionMinIdx && p.selectionPhase === 'scanning';
            const isScan = idx === p.selectionScanIdx && p.selectionPhase === 'scanning';
            return (
              <div key={idx} className="font-mono" style={{
                flex: '1 1 0', minWidth: 0, textAlign: 'center', fontSize: 'clamp(7px, 1.2vw, 9px)',
                color: isMin ? C.violet : isScan ? C.cobalt : isScanStart && !isMin ? C.soft : 'transparent',
                letterSpacing: '0.1em', fontWeight: 600,
              }}>{isMin ? '★ MIN' : isScan ? '▼ SCAN' : ''}</div>
            );
          })}
        </div>
      )}
      {!p.finished && p.school === 'heap' && (() => {
        const pos = p.siftPos !== null ? p.siftPos : (p.heapPhase === 'building' ? p.heapBuildIdx : 0);
        const left = 2 * pos + 1;
        const right = 2 * pos + 2;
        return (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(2px, 0.5vw, 6px)', marginBottom: 4, maxWidth: 900, margin: '0 auto 4px' }}>
            {p.lane.map((_, idx) => {
              const isParent = idx === pos;
              const isLeftChild = idx === left && left < p.heapSize;
              const isRightChild = idx === right && right < p.heapSize;
              return (
                <div key={idx} className="font-mono" style={{
                  flex: '1 1 0', minWidth: 0, textAlign: 'center', fontSize: 'clamp(6px, 1vw, 8px)',
                  color: isParent ? C.slate : isLeftChild ? C.cobalt : isRightChild ? C.crimson : 'transparent',
                  letterSpacing: '0.08em', fontWeight: 600,
                }}>{isParent ? '▼ NODE' : isLeftChild ? 'L' : isRightChild ? 'R' : ''}</div>
              );
            })}
          </div>
        );
      })()}
      {!p.finished && p.school === 'radix' && p.radixPhase === 'placing' && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(2px, 0.5vw, 6px)', marginBottom: 4, maxWidth: 900, margin: '0 auto 4px' }}>
          {p.lane.map((_, idx) => (
            <div key={idx} className="font-mono" style={{
              flex: '1 1 0', minWidth: 0, textAlign: 'center', fontSize: 'clamp(7px, 1.2vw, 9px)',
              color: idx === p.radixCardIdx ? C.teal : 'transparent',
              letterSpacing: '0.1em', fontWeight: 600,
            }}>▼</div>
          ))}
        </div>
      )}
      {!p.finished && p.school === 'merge' && (
        (() => {
          const groups = computeMergeGroups(p.mergeOps, p.currentMergeOpIdx, p.lane.length);
          const op = p.mergeState ? p.mergeState.op : (p.mergeOps[p.currentMergeOpIdx] || null);
          const cardW = compact ? 52 : 69; // card width + gap
          return (
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
              <div style={{ position: 'relative', width: cardW * p.lane.length }}>
                {/* LEFT / RIGHT labels for active merge */}
                {op && (
                  <div style={{ display: 'flex', position: 'relative', height: 16 }}>
                    {p.lane.map((_, idx) => {
                      const isLeft = idx >= op.start && idx < op.mid;
                      const isRight = idx >= op.mid && idx < op.end;
                      return (
                        <div key={idx} className="font-mono" style={{
                          width: cardW, textAlign: 'center', fontSize: 9, lineHeight: '16px',
                          color: isLeft ? C.cobalt : isRight ? C.crimson : 'transparent',
                          letterSpacing: '0.1em', fontWeight: 600,
                        }}>{isLeft ? 'LEFT' : isRight ? 'RIGHT' : ''}</div>
                      );
                    })}
                  </div>
                )}
                {/* Group brackets underneath will appear below the lane */}
                {/* Render bracket overlay data as a data attribute for the bracket row below */}
              </div>
            </div>
          );
        })()
      )}

      {/* The lane itself */}
      <Lane
        lane={p.lane}
        highlights={p.highlights}
        onCardClick={(idx) => {
          if (p.school === 'quick' && p.quickPhase === 'choose_pivot') {
            dispatch({ type: 'QUICK_CHOOSE_PIVOT', idx, playerIdx });
          }
        }}
        clickablePredicate={(idx, card) => {
          if (p.school !== 'quick' || p.quickPhase !== 'choose_pivot') return false;
          if (p.finished) return false;
          const [s, e] = p.activeRange;
          return !card.locked && idx >= s && idx < e;
        }}
      />

      {/* Merge group brackets below lane */}
      {!p.finished && p.school === 'merge' && (() => {
        const groups = computeMergeGroups(p.mergeOps, p.currentMergeOpIdx, p.lane.length);
        const op = p.mergeState ? p.mergeState.op : (p.mergeOps[p.currentMergeOpIdx] || null);
        const cardW = compact ? 52 : 69;
        const levelInfo = getMergeLevelInfo(p.mergeOps, p.currentMergeOpIdx, p.lane.length);
        return (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex' }}>
                {groups.map((g, gi) => {
                  const w = g.size * cardW;
                  const isActiveLeft = op && g.start === op.start && g.end === op.mid;
                  const isActiveRight = op && g.start === op.mid && g.end === op.end;
                  const isActive = isActiveLeft || isActiveRight;
                  const isSorted = g.size > 1;
                  const bracketColor = isActiveLeft ? C.cobalt : isActiveRight ? C.crimson : isSorted ? C.emerald : C.rule;
                  const bgColor = isActiveLeft ? `${C.cobalt}10` : isActiveRight ? `${C.crimson}08` : 'transparent';
                  return (
                    <div key={gi} style={{
                      width: w, textAlign: 'center', position: 'relative',
                      borderLeft: `2px solid ${bracketColor}`,
                      borderRight: `2px solid ${bracketColor}`,
                      borderBottom: `2px solid ${bracketColor}`,
                      borderTop: 'none',
                      height: 20, marginTop: 2,
                      background: bgColor,
                      borderRadius: '0 0 4px 4px',
                      transition: 'all 0.3s ease',
                    }}>
                      <span className="font-mono" style={{
                        position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)',
                        fontSize: 8, whiteSpace: 'nowrap',
                        color: isActive ? bracketColor : isSorted ? C.emerald : C.soft,
                        fontWeight: isActive ? 700 : 500, letterSpacing: '0.08em',
                      }}>
                        {isActiveLeft ? '◀ LEFT' : isActiveRight ? 'RIGHT ▶' : isSorted ? `✓ sorted` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Level progress bar */}
              <div className="font-sans" style={{
                textAlign: 'center', marginTop: 6, fontSize: 10, color: C.cobalt,
                fontWeight: 500, letterSpacing: '0.05em',
              }}>
                {levelInfo.desc}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Partition tray */}
      {showTray && p.pivotIdx !== null && (blueCards.length > 0 || redCards.length > 0) && (
        <div style={{
          marginTop: 16, display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 2,
          border: `1px solid ${C.rule}`,
        }}>
          <div style={{ background: 'rgba(44, 74, 127, 0.06)', padding: '10px 14px', minHeight: 80 }}>
            <div className="font-sans" style={{
              fontSize: 9, color: C.cobalt, letterSpacing: '0.15em',
              textTransform: 'uppercase', marginBottom: 8, fontWeight: 600,
            }}>&lt; Pivot (Left)</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {blueCards.map(c => <DragonCard key={c.id} value={c.value} compact mobile={mobile} />)}
            </div>
          </div>
          <div style={{ background: 'rgba(168, 50, 43, 0.05)', padding: '10px 14px', minHeight: 80 }}>
            <div className="font-sans" style={{
              fontSize: 9, color: C.crimson, letterSpacing: '0.15em',
              textTransform: 'uppercase', marginBottom: 8, fontWeight: 600,
            }}>≥ Pivot (Right)</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {redCards.map(c => <DragonCard key={c.id} value={c.value} compact mobile={mobile} />)}
            </div>
          </div>
        </div>
      )}

      {/* Merge tray */}
      {p.school === 'merge' && p.mergeState && p.mergeState.merged.length > 0 && (
        <div style={{
          marginTop: 16, border: `1px solid ${C.cobalt}30`,
          background: 'rgba(44, 74, 127, 0.04)', padding: '10px 14px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div className="font-sans" style={{
              fontSize: 9, color: C.cobalt, letterSpacing: '0.15em',
              textTransform: 'uppercase', fontWeight: 600,
            }}>Combined Result (sorted so far)</div>
            <div className="font-mono" style={{ fontSize: 9, color: C.soft }}>
              {p.mergeState.merged.length} of {p.mergeState.op.end - p.mergeState.op.start} cards placed
            </div>
          </div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {p.mergeState.merged.map(c => <DragonCard key={c.id} value={c.value} compact mobile={mobile} />)}
          </div>
          {/* Show remaining from each side */}
          <div style={{ display: 'flex', gap: mobile ? 8 : 16, marginTop: 8, fontSize: 10, color: C.soft, flexWrap: 'wrap' }}>
            <span className="font-mono">
              Left remaining: [{p.mergeState.leftCards.slice(p.mergeState.leftPos).map(c => c.value).join(', ') || 'empty'}]
            </span>
            <span className="font-mono">
              Right remaining: [{p.mergeState.rightCards.slice(p.mergeState.rightPos).map(c => c.value).join(', ') || 'empty'}]
            </span>
          </div>
        </div>
      )}

      {/* Action area */}
      {!p.finished && (
        <div style={{
          marginTop: 16, padding: mobile ? '12px' : '16px 20px',
          background: C.paper, border: `1px solid ${C.rule}`,
        }}>
          <ActionArea state={p} dispatch={dispatch} playerIdx={playerIdx} />
        </div>
      )}
    </div>
  );
};

// Persistent algorithm rule card — always visible so players know the one rule they follow
const AlgoRule = ({ school }) => {
  const rules = {
    bubble: { rule: 'Compare neighbors. If left > right, swap them.', color: C.gold },
    quick: { rule: 'Pick a pivot. Put smaller cards left, bigger cards right.', color: C.crimson },
    insertion: { rule: 'Pick up the next card. Slide it left until it fits.', color: C.emerald },
    selection: { rule: 'Find the smallest card. Put it in the next open spot.', color: C.violet },
    merge: { rule: 'Combine two sorted groups into one by always picking the smaller front card.', color: C.cobalt },
    heap: { rule: 'Build a max-heap, then extract the largest card repeatedly.', color: C.slate },
    radix: { rule: 'Sort cards by digit — ones first, then tens. No comparisons needed!', color: C.teal },
  };
  const r = rules[school];
  if (!r) return null;
  return (
    <div style={{
      padding: '8px 14px', marginBottom: 12,
      borderLeft: `3px solid ${r.color}`, background: `${r.color}11`,
    }}>
      <span className="font-mono" style={{ fontSize: 9, color: r.color, letterSpacing: '0.15em', fontWeight: 600 }}>
        YOUR RULE
      </span>
      <span className="font-sans" style={{ fontSize: 12, color: C.ink, marginLeft: 10 }}>
        {r.rule}
      </span>
    </div>
  );
};

// Shared comparison prompt — the core UX pattern every algorithm uses
const ComparePrompt = ({ leftLabel, leftVal, rightLabel, rightVal, children }) => (
  <div>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 12, marginBottom: 14, padding: '10px 0',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div className="font-mono" style={{ fontSize: 9, color: C.soft, letterSpacing: '0.12em', marginBottom: 2 }}>
          {leftLabel}
        </div>
        <div className="font-serif" style={{ fontSize: 32, fontWeight: 600, color: C.ink }}>{leftVal}</div>
      </div>
      <div className="font-sans" style={{ fontSize: 13, color: C.slate, fontWeight: 500, padding: '0 4px' }}>vs</div>
      <div style={{ textAlign: 'center' }}>
        <div className="font-mono" style={{ fontSize: 9, color: C.soft, letterSpacing: '0.12em', marginBottom: 2 }}>
          {rightLabel}
        </div>
        <div className="font-serif" style={{ fontSize: 32, fontWeight: 600, color: C.ink }}>{rightVal}</div>
      </div>
    </div>
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {children}
    </div>
  </div>
);

// Step progress dots
const StepDots = ({ current, total, color }) => (
  <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 10 }}>
    <span className="font-mono" style={{ fontSize: 9, color: C.soft, letterSpacing: '0.1em', marginRight: 6 }}>
      STEP {current}/{total}
    </span>
    {Array.from({ length: total }, (_, i) => (
      <div key={i} style={{
        width: 6, height: 6, borderRadius: '50%',
        background: i < current ? color : C.rule,
        transition: 'background 0.2s',
      }} />
    ))}
  </div>
);

const ActionArea = ({ state: p, dispatch, playerIdx }) => {
  if (p.finished) return null;

  // ── BUBBLE SORT ──────────────────────────────
  if (p.school === 'bubble') {
    if (p.pendingAction) {
      const { left, right } = p.pendingAction;
      return (
        <div>
          <AlgoRule school="bubble" />
          <ComparePrompt leftLabel="LEFT" leftVal={left} rightLabel="RIGHT" rightVal={right}>
            <Button variant="swap" small onClick={() => dispatch({ type: 'BUBBLE_EXECUTE', swap: true, playerIdx })}>
              ← Swap ({left} &gt; {right})
            </Button>
            <Button variant="keep" small onClick={() => dispatch({ type: 'BUBBLE_EXECUTE', swap: false, playerIdx })}>
              Keep → ({left} ≤ {right})
            </Button>
          </ComparePrompt>
        </div>
      );
    }
    return (
      <div>
        <AlgoRule school="bubble" />
        <div className="font-sans" style={{ fontSize: 13, color: C.ink, marginBottom: 10 }}>
          👉 Compare cards at positions <strong>{p.pawn + 1}</strong> and <strong>{p.pawn + 2}</strong>.
        </div>
        <Button small onClick={() => dispatch({ type: 'BUBBLE_SETUP_COMPARE', playerIdx })}>
          Compare Next Pair
        </Button>
      </div>
    );
  }

  // ── QUICK SORT ──────────────────────────────
  if (p.school === 'quick') {
    if (p.quickPhase === 'choose_pivot') {
      const [s, e] = p.activeRange;
      return (
        <div>
          <AlgoRule school="quick" />
          <div className="font-sans" style={{ fontSize: 13, color: C.ink, marginBottom: 6 }}>
            👉 <strong>Pick a pivot card.</strong> Click any card with the ▼ arrow above it.
          </div>
          <div className="font-sans" style={{ fontSize: 11, color: C.soft, lineHeight: 1.5 }}>
            The pivot is the card you'll compare everything against. A card near the middle
            of the range (positions {s + 1}–{e}) usually works best.
          </div>
        </div>
      );
    }
    if (p.quickPhase === 'comparing') {
      if (p.pendingAction) {
        const { cardVal, pivotVal } = p.pendingAction;
        return (
          <div>
            <AlgoRule school="quick" />
            <div className="font-sans" style={{ fontSize: 12, color: C.soft, marginBottom: 4 }}>
              Is <strong style={{ color: C.ink }}>{cardVal}</strong> smaller than the pivot <strong style={{ color: C.ink }}>{pivotVal}</strong>?
            </div>
            <ComparePrompt leftLabel="THIS CARD" leftVal={cardVal} rightLabel="PIVOT" rightVal={pivotVal}>
              <Button variant="keep" small onClick={() => dispatch({ type: 'QUICK_EXECUTE', toBlue: true, playerIdx })}>
                {cardVal} &lt; {pivotVal}
              </Button>
              <Button variant="swap" small onClick={() => dispatch({ type: 'QUICK_EXECUTE', toBlue: false, playerIdx })}>
                {cardVal} ≥ {pivotVal}
              </Button>
            </ComparePrompt>
          </div>
        );
      }
      return (
        <div>
          <AlgoRule school="quick" />
          <div className="font-sans" style={{ fontSize: 13, color: C.ink, marginBottom: 10 }}>
            👉 Compare the next card (position {p.compareIdx + 1}) against the pivot.
          </div>
          <Button small onClick={() => dispatch({ type: 'QUICK_SETUP_COMPARE', playerIdx })}>
            Compare Next Card
          </Button>
        </div>
      );
    }
    if (p.quickPhase === 'seal') {
      return (
        <div>
          <AlgoRule school="quick" />
          <div className="font-sans" style={{ fontSize: 13, color: C.ink, marginBottom: 10 }}>
            ✅ All cards sorted around the pivot. Lock it in place!
          </div>
          <Button variant="gold" small onClick={() => dispatch({ type: 'QUICK_SEAL', playerIdx })}>
            Lock Pivot
          </Button>
        </div>
      );
    }
  }

  // ── INSERTION SORT ──────────────────────────────
  if (p.school === 'insertion') {
    if (p.pendingAction && p.pendingAction.type === 'insertion_compare') {
      const { heldVal, cmpVal } = p.pendingAction;
      return (
        <div>
          <AlgoRule school="insertion" />
          <div className="font-sans" style={{ fontSize: 12, color: C.soft, marginBottom: 4 }}>
            You're holding <strong style={{ color: C.ink }}>{heldVal}</strong>.
            Is <strong style={{ color: C.ink }}>{cmpVal}</strong> blocking it?
          </div>
          <ComparePrompt leftLabel="HOLDING" leftVal={heldVal} rightLabel="IN THE WAY?" rightVal={cmpVal}>
            <Button variant="swap" small onClick={() => dispatch({ type: 'INSERTION_EXECUTE', shift: true, playerIdx })}>
              {cmpVal} &gt; {heldVal} → Slide {cmpVal} right
            </Button>
            <Button variant="keep" small onClick={() => dispatch({ type: 'INSERTION_EXECUTE', shift: false, playerIdx })}>
              {heldVal} fits here → Drop it
            </Button>
          </ComparePrompt>
        </div>
      );
    }
    if (p.insertionSorted < p.lane.length) {
      const cardVal = p.lane[p.heldCardIdx !== null ? p.heldCardIdx : p.insertionSorted].value;
      const scanTarget = p.scanPos !== null ? p.scanPos : p.insertionSorted - 1;
      return (
        <div>
          <AlgoRule school="insertion" />
          <StepDots current={p.insertionSorted} total={p.lane.length - 1} color={C.emerald} />
          <div className="font-sans" style={{ fontSize: 13, color: C.ink, marginBottom: 10 }}>
            👉 Holding card <strong>{cardVal}</strong>. Compare it with the card at position {scanTarget + 1}.
          </div>
          <Button small onClick={() => dispatch({ type: 'INSERTION_SETUP_COMPARE', playerIdx })}>
            Compare
          </Button>
        </div>
      );
    }
    return null;
  }

  // ── SELECTION SORT ──────────────────────────────
  if (p.school === 'selection') {
    if (p.selectionPhase === 'confirm_swap') {
      const minVal = p.lane[p.selectionMinIdx].value;
      const destVal = p.lane[p.selectionScanStart].value;
      const needsSwap = p.selectionMinIdx !== p.selectionScanStart;
      return (
        <div>
          <AlgoRule school="selection" />
          <div className="font-sans" style={{ fontSize: 13, color: C.ink, marginBottom: 10 }}>
            ✅ Found the smallest: <strong>{minVal}</strong>.
            {needsSwap
              ? ` Move it to position ${p.selectionScanStart + 1} (swapping with ${destVal}).`
              : ` It's already in position ${p.selectionScanStart + 1} — just lock it.`}
          </div>
          <Button variant="gold" small onClick={() => dispatch({ type: 'SELECTION_SWAP', playerIdx })}>
            {needsSwap ? `Swap ${minVal} into Place` : `Lock ${minVal}`}
          </Button>
        </div>
      );
    }
    if (p.pendingAction && p.pendingAction.type === 'selection_compare') {
      const { scanVal, minVal } = p.pendingAction;
      return (
        <div>
          <AlgoRule school="selection" />
          <div className="font-sans" style={{ fontSize: 12, color: C.soft, marginBottom: 4 }}>
            Is <strong style={{ color: C.ink }}>{scanVal}</strong> smaller than the current smallest <strong style={{ color: C.ink }}>{minVal}</strong>?
          </div>
          <ComparePrompt leftLabel="THIS CARD" leftVal={scanVal} rightLabel="CURRENT SMALLEST" rightVal={minVal}>
            <Button variant="swap" small onClick={() => dispatch({ type: 'SELECTION_EXECUTE', isNewMin: true, playerIdx })}>
              {scanVal} &lt; {minVal} → New Smallest
            </Button>
            <Button variant="keep" small onClick={() => dispatch({ type: 'SELECTION_EXECUTE', isNewMin: false, playerIdx })}>
              {scanVal} ≥ {minVal} → Keep Looking
            </Button>
          </ComparePrompt>
        </div>
      );
    }
    if (p.selectionScanIdx < p.lane.length) {
      return (
        <div>
          <AlgoRule school="selection" />
          <StepDots current={p.selectionScanStart} total={p.lane.length - 1} color={C.violet} />
          <div className="font-sans" style={{ fontSize: 13, color: C.ink, marginBottom: 10 }}>
            👉 Scanning for the smallest card. Current smallest: <strong>{p.lane[p.selectionMinIdx].value}</strong>.
            Check position {p.selectionScanIdx + 1} next.
          </div>
          <Button small onClick={() => dispatch({ type: 'SELECTION_SETUP_COMPARE', playerIdx })}>
            Check Next Card
          </Button>
        </div>
      );
    }
    return null;
  }

  // ── MERGE SORT ──────────────────────────────
  if (p.school === 'merge') {
    const levelInfo = getMergeLevelInfo(p.mergeOps, p.currentMergeOpIdx, p.lane.length);

    if (p.mergePhase === 'start_merge') {
      const op = p.mergeOps[p.currentMergeOpIdx];
      if (!op) return null;
      const leftVals = p.lane.slice(op.start, op.mid).map(c => c.value);
      const rightVals = p.lane.slice(op.mid, op.end).map(c => c.value);
      const isFirstEver = p.currentMergeOpIdx === 0;
      return (
        <div>
          <AlgoRule school="merge" />

          {/* Level progress */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
            padding: '6px 10px', background: `${C.cobalt}08`, borderRadius: 3,
          }}>
            <div style={{
              display: 'flex', gap: 3,
            }}>
              {Array.from({ length: levelInfo.totalLevels }, (_, i) => (
                <div key={i} style={{
                  width: 18, height: 4, borderRadius: 2,
                  background: i < levelInfo.level ? C.cobalt : C.rule,
                  transition: 'background 0.3s',
                }} />
              ))}
            </div>
            <span className="font-mono" style={{ fontSize: 9, color: C.cobalt, letterSpacing: '0.08em', fontWeight: 600 }}>
              {levelInfo.shortDesc}
            </span>
            <span className="font-mono" style={{ fontSize: 9, color: C.soft, letterSpacing: '0.08em', marginLeft: 'auto' }}>
              Merge {levelInfo.opInLevel}/{levelInfo.opsThisLevel} this pass
            </span>
          </div>

          {/* Explanation */}
          <div className="font-sans" style={{ fontSize: 13, color: C.ink, marginBottom: 8, lineHeight: 1.5 }}>
            {isFirstEver ? (
              <>👉 <strong>Goal:</strong> Combine these two groups into one sorted group. You'll compare one card from each side and always pick the smaller one.</>
            ) : (
              <>👉 Next up: combine these two groups. Compare front cards, pick the smaller one each time.</>
            )}
          </div>

          {/* Visual: which groups are being merged */}
          <div style={{
            display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12, marginTop: 8, alignItems: 'stretch',
          }}>
            <div style={{
              padding: '8px 14px', background: `${C.cobalt}12`, border: `2px solid ${C.cobalt}50`,
              borderRadius: 4, textAlign: 'center', flex: '0 1 auto',
            }}>
              <div className="font-mono" style={{ fontSize: 8, color: C.cobalt, letterSpacing: '0.15em', fontWeight: 700, marginBottom: 4 }}>
                ◀ LEFT GROUP
              </div>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                {leftVals.map((v, i) => (
                  <span key={i} className="font-serif" style={{
                    fontSize: 18, fontWeight: 600, color: C.ink,
                    padding: '2px 6px', background: C.cream, borderRadius: 3,
                    border: `1px solid ${C.cobalt}30`,
                  }}>{v}</span>
                ))}
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', padding: '0 4px',
            }}>
              <span className="font-serif" style={{ fontSize: 20, color: C.soft }}>→</span>
            </div>
            <div style={{
              padding: '8px 12px', background: `${C.emerald}08`, border: `2px dashed ${C.emerald}40`,
              borderRadius: 4, textAlign: 'center', flex: '0 1 auto',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <div className="font-mono" style={{ fontSize: 8, color: C.emerald, letterSpacing: '0.15em', fontWeight: 700, marginBottom: 2 }}>
                RESULT
              </div>
              <span className="font-sans" style={{ fontSize: 11, color: C.soft, fontStyle: 'italic' }}>
                {leftVals.length + rightVals.length} cards sorted
              </span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', padding: '0 4px',
            }}>
              <span className="font-serif" style={{ fontSize: 20, color: C.soft }}>←</span>
            </div>
            <div style={{
              padding: '8px 14px', background: `${C.crimson}08`, border: `2px solid ${C.crimson}40`,
              borderRadius: 4, textAlign: 'center', flex: '0 1 auto',
            }}>
              <div className="font-mono" style={{ fontSize: 8, color: C.crimson, letterSpacing: '0.15em', fontWeight: 700, marginBottom: 4 }}>
                RIGHT GROUP ▶
              </div>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                {rightVals.map((v, i) => (
                  <span key={i} className="font-serif" style={{
                    fontSize: 18, fontWeight: 600, color: C.ink,
                    padding: '2px 6px', background: C.cream, borderRadius: 3,
                    border: `1px solid ${C.crimson}30`,
                  }}>{v}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Button small onClick={() => dispatch({ type: 'MERGE_START', playerIdx })}>
              Compare & Combine →
            </Button>
          </div>
        </div>
      );
    }
    if (p.mergePhase === 'comparing' && p.mergeState) {
      const { leftCards, rightCards, leftPos, rightPos, merged } = p.mergeState;
      const totalCards = leftCards.length + rightCards.length;
      if (p.pendingAction && p.pendingAction.type === 'merge_compare') {
        const { leftVal, rightVal } = p.pendingAction;
        return (
          <div>
            <AlgoRule school="merge" />
            <div className="font-sans" style={{ fontSize: 13, color: C.ink, marginBottom: 6, lineHeight: 1.5 }}>
              👉 Compare the <strong style={{ color: C.cobalt }}>front of Left</strong> vs <strong style={{ color: C.crimson }}>front of Right</strong>. Pick the smaller card to add to the sorted result.
            </div>

            {/* Progress */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
            }}>
              <div style={{ flex: 1, height: 4, background: C.rule, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${(merged.length / totalCards) * 100}%`,
                  background: C.emerald, borderRadius: 2, transition: 'width 0.3s ease',
                }} />
              </div>
              <span className="font-mono" style={{ fontSize: 9, color: C.soft }}>{merged.length}/{totalCards}</span>
            </div>

            <ComparePrompt leftLabel="LEFT FRONT" leftVal={leftVal} rightLabel="RIGHT FRONT" rightVal={rightVal}>
              <Button variant="keep" small onClick={() => dispatch({ type: 'MERGE_EXECUTE', takeLeft: true, playerIdx })}>
                Take {leftVal} (from Left)
              </Button>
              <Button variant="swap" small onClick={() => dispatch({ type: 'MERGE_EXECUTE', takeLeft: false, playerIdx })}>
                Take {rightVal} (from Right)
              </Button>
            </ComparePrompt>

            {/* Remaining in each group */}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 10 }}>
              <div style={{ textAlign: 'center' }}>
                <div className="font-mono" style={{ fontSize: 8, color: C.cobalt, letterSpacing: '0.1em', fontWeight: 600, marginBottom: 3 }}>LEFT REMAINING</div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {leftCards.slice(leftPos).map((c, i) => (
                    <span key={i} className="font-mono" style={{
                      fontSize: 12, padding: '2px 5px', background: i === 0 ? `${C.cobalt}20` : C.cream,
                      border: `1px solid ${i === 0 ? C.cobalt : C.rule}`, borderRadius: 2,
                      fontWeight: i === 0 ? 700 : 400,
                    }}>{c.value}</span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="font-mono" style={{ fontSize: 8, color: C.crimson, letterSpacing: '0.1em', fontWeight: 600, marginBottom: 3 }}>RIGHT REMAINING</div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {rightCards.slice(rightPos).map((c, i) => (
                    <span key={i} className="font-mono" style={{
                      fontSize: 12, padding: '2px 5px', background: i === 0 ? `${C.crimson}15` : C.cream,
                      border: `1px solid ${i === 0 ? C.crimson : C.rule}`, borderRadius: 2,
                      fontWeight: i === 0 ? 700 : 400,
                    }}>{c.value}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      }
      const leftDone = leftPos >= leftCards.length;
      const rightDone = rightPos >= rightCards.length;
      if (leftDone || rightDone) {
        return (
          <div>
            <AlgoRule school="merge" />
            <div className="font-sans" style={{ fontSize: 13, color: C.emerald, marginBottom: 10, fontWeight: 500 }}>
              ✓ One group is empty — the remaining cards go straight to the result!
            </div>
          </div>
        );
      }
      return (
        <div>
          <AlgoRule school="merge" />
          <div className="font-sans" style={{ fontSize: 13, color: C.ink, marginBottom: 6, lineHeight: 1.5 }}>
            👉 Look at the <strong>first card</strong> from each group. Click below to compare them.
          </div>

          {/* Show front cards of each group */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 10, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="font-mono" style={{ fontSize: 8, color: C.cobalt, letterSpacing: '0.1em', fontWeight: 600, marginBottom: 3 }}>LEFT FRONT</div>
              <span className="font-serif" style={{
                fontSize: 24, fontWeight: 600, color: C.ink,
                padding: '4px 10px', background: `${C.cobalt}15`,
                border: `2px solid ${C.cobalt}`, borderRadius: 4, display: 'inline-block',
              }}>{leftCards[leftPos].value}</span>
            </div>
            <span className="font-sans" style={{ fontSize: 12, color: C.soft }}>vs</span>
            <div style={{ textAlign: 'center' }}>
              <div className="font-mono" style={{ fontSize: 8, color: C.crimson, letterSpacing: '0.1em', fontWeight: 600, marginBottom: 3 }}>RIGHT FRONT</div>
              <span className="font-serif" style={{
                fontSize: 24, fontWeight: 600, color: C.ink,
                padding: '4px 10px', background: `${C.crimson}12`,
                border: `2px solid ${C.crimson}`, borderRadius: 4, display: 'inline-block',
              }}>{rightCards[rightPos].value}</span>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Button small onClick={() => dispatch({ type: 'MERGE_SETUP_COMPARE', playerIdx })}>
              Which is smaller? →
            </Button>
          </div>
        </div>
      );
    }
    return null;
  }

  // ── HEAP SORT ──────────────────────────────
  if (p.school === 'heap') {
    if (p.pendingAction && p.pendingAction.type === 'heap_compare') {
      const { parentVal, childVal, parentIdx, childIdx } = p.pendingAction;
      const childSide = childIdx === 2 * parentIdx + 1 ? 'left' : 'right';
      return (
        <div>
          <AlgoRule school="heap" />
          <div className="font-sans" style={{ fontSize: 12, color: C.soft, marginBottom: 4 }}>
            Is the <strong style={{ color: C.ink }}>{childSide} child ({childVal})</strong> larger than the parent <strong style={{ color: C.ink }}>({parentVal})</strong>?
          </div>
          <ComparePrompt leftLabel="PARENT" leftVal={parentVal} rightLabel="LARGEST CHILD" rightVal={childVal}>
            <Button variant="swap" small onClick={() => dispatch({ type: 'HEAP_EXECUTE', swap: true, playerIdx })}>
              {childVal} &gt; {parentVal} → Swap down
            </Button>
            <Button variant="keep" small onClick={() => dispatch({ type: 'HEAP_EXECUTE', swap: false, playerIdx })}>
              {parentVal} ≥ {childVal} → Stays
            </Button>
          </ComparePrompt>
        </div>
      );
    }
    if (p.heapPhase === 'building') {
      const pos = p.siftPos !== null ? p.siftPos : p.heapBuildIdx;
      const left = 2 * pos + 1;
      const right = 2 * pos + 2;
      const hasChildren = left < p.heapSize;
      if (!hasChildren) {
        // Auto-advance: no children to compare
        return (
          <div>
            <AlgoRule school="heap" />
            <div className="font-sans" style={{ fontSize: 13, color: C.ink, marginBottom: 10 }}>
              👉 Node at position {pos + 1} has no children. Move to next node.
            </div>
            <Button small onClick={() => dispatch({ type: 'HEAP_SETUP_COMPARE', playerIdx })}>
              Next Node
            </Button>
          </div>
        );
      }
      return (
        <div>
          <AlgoRule school="heap" />
          <StepDots current={Math.floor(p.lane.length / 2) - p.heapBuildIdx} total={Math.floor(p.lane.length / 2)} color={C.slate} />
          <div className="font-sans" style={{ fontSize: 13, color: C.ink, marginBottom: 10 }}>
            👉 <strong>Building heap:</strong> Check node at position {pos + 1} against its children.
          </div>
          <Button small onClick={() => dispatch({ type: 'HEAP_SETUP_COMPARE', playerIdx })}>
            Check Node
          </Button>
        </div>
      );
    }
    if (p.heapPhase === 'extract_swap') {
      return (
        <div>
          <AlgoRule school="heap" />
          <div className="font-sans" style={{ fontSize: 13, color: C.ink, marginBottom: 10 }}>
            ✅ Heap is valid! The root (<strong>{p.lane[0].value}</strong>) is the max. Extract it to position {p.heapSize}.
          </div>
          <Button variant="gold" small onClick={() => dispatch({ type: 'HEAP_EXTRACT', playerIdx })}>
            Extract Max ({p.lane[0].value})
          </Button>
        </div>
      );
    }
    if (p.heapPhase === 'extract_sift') {
      return (
        <div>
          <AlgoRule school="heap" />
          <div className="font-sans" style={{ fontSize: 13, color: C.ink, marginBottom: 10 }}>
            👉 New root is <strong>{p.lane[p.siftPos !== null ? p.siftPos : 0].value}</strong>. Sift it down to restore the heap.
          </div>
          <Button small onClick={() => dispatch({ type: 'HEAP_SETUP_COMPARE', playerIdx })}>
            Check Node
          </Button>
        </div>
      );
    }
    return null;
  }

  // ── RADIX SORT ──────────────────────────────
  if (p.school === 'radix') {
    if (p.radixPhase === 'placing') {
      const card = p.lane[p.radixCardIdx];
      const digitName = p.radixPass === 0 ? 'ones' : 'tens';
      return (
        <div>
          <AlgoRule school="radix" />
          <div className="font-sans" style={{ fontSize: 13, color: C.ink, marginBottom: 8 }}>
            👉 Card <strong>{card.value}</strong> — what is its <strong>{digitName} digit</strong>? Place it in the correct bucket.
          </div>

          {/* Bucket buttons */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            {Array.from({ length: 10 }, (_, i) => (
              <button key={i} onClick={() => dispatch({ type: 'RADIX_PLACE', bucket: i, playerIdx })} style={{
                width: 40, height: 40, border: `1px solid ${C.rule}`, borderRadius: 4,
                background: C.cream, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace',
                fontSize: 16, fontWeight: 600, color: C.ink, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.target.style.background = C.teal; e.target.style.color = C.cream; }}
              onMouseLeave={e => { e.target.style.background = C.cream; e.target.style.color = C.ink; }}
              >
                {i}
              </button>
            ))}
          </div>

          {/* Show current buckets */}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
            {p.radixBuckets.map((bucket, i) => (
              <div key={i} style={{
                minWidth: 30, padding: '3px 4px', border: `1px solid ${C.rule}`, borderRadius: 3,
                textAlign: 'center', background: bucket.length > 0 ? `${C.teal}10` : 'transparent',
              }}>
                <div className="font-mono" style={{ fontSize: 7, color: C.soft, letterSpacing: '0.1em' }}>{i}</div>
                {bucket.map((c, j) => (
                  <div key={j} className="font-mono" style={{ fontSize: 10, color: C.ink }}>{c.value}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (p.radixPhase === 'collecting') {
      return (
        <div>
          <AlgoRule school="radix" />
          <div className="font-sans" style={{ fontSize: 13, color: C.emerald, marginBottom: 8, fontWeight: 500 }}>
            ✅ All cards placed! Collect from buckets 0→9 to form the new order.
          </div>

          {/* Show filled buckets */}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            {p.radixBuckets.map((bucket, i) => (
              <div key={i} style={{
                minWidth: 30, padding: '3px 4px', border: `1px solid ${bucket.length > 0 ? C.teal : C.rule}`, borderRadius: 3,
                textAlign: 'center', background: bucket.length > 0 ? `${C.teal}15` : 'transparent',
              }}>
                <div className="font-mono" style={{ fontSize: 7, color: C.soft, letterSpacing: '0.1em' }}>{i}</div>
                {bucket.map((c, j) => (
                  <div key={j} className="font-mono" style={{ fontSize: 10, color: C.ink, fontWeight: 600 }}>{c.value}</div>
                ))}
              </div>
            ))}
          </div>

          <Button small onClick={() => dispatch({ type: 'RADIX_COLLECT', playerIdx })}>
            Collect from Buckets →
          </Button>
        </div>
      );
    }
    return null;
  }

  return null;
};

const DemoPlay = ({ initial, onReset }) => {
  const [state, dispatch] = useReducer(rootReducer, initial, () =>
    initialState(initial.school, initial.mode, initial.deckSize || 8)
  );
  const hint = state.mode === 'tutorial' ? getTutorialHint(state, 0) : null;
  const allFinished = state.players.every(p => p.finished);

  // Calculate scores once when finished
  const scores = allFinished ? state.players.map(p => {
    const mins = state.mins[p.school];
    const excess = Math.max(0, p.comparisons - mins);
    return Math.max(0, Math.round(100 - (100 * excess / mins) - p.penalties * 5));
  }) : [];

  const deckLabel = state.deckSize === 6 ? 'Easy' : state.deckSize === 10 ? 'Hard' : state.deckSize === 12 ? 'Expert' : 'Normal';

  return (
    <div className="setup-container" style={{ padding: '40px 40px 48px', position: 'relative' }}>

      {/* Top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: 16, marginBottom: 20, borderBottom: `1px solid ${C.rule}`,
      }}>
        <div>
          <Eyebrow>
            {state.mode === 'tutorial' ? 'Tutorial' : 'Solo Practice'}
            {' · '}
            {state.deckSize} Cards ({deckLabel})
          </Eyebrow>
        </div>
        <button onClick={() => onReset(null)} className="font-mono" style={{
          background: 'transparent', border: 'none', fontSize: 10,
          color: C.soft, letterSpacing: '0.2em', textTransform: 'uppercase',
          cursor: 'pointer', fontWeight: 500,
        }}>← New Round</button>
      </div>

      {/* Tutorial hint */}
      {hint && !allFinished && (
        <div key={hint} style={{
          background: '#FFF8E1', border: `1px solid ${C.gold}`,
          borderLeft: `4px solid ${C.gold}`, padding: '12px 18px', marginBottom: 20,
          animation: 'fadeUp 0.3s ease-out',
        }}>
          <span className="font-sans" style={{
            fontWeight: 600, letterSpacing: '0.1em', fontSize: 9,
            textTransform: 'uppercase', color: C.gold, marginRight: 10,
          }}>Hint</span>
          <span className="font-sans" style={{ fontSize: 12, color: C.ink, lineHeight: 1.5 }}>{hint}</span>
        </div>
      )}

      {/* Player panels */}
      <div>
        <PlayerPanel
          state={state}
          dispatch={dispatch}
          playerIdx={0}
          activePlayerIdx={0}
          mode={state.mode}
          scenarioMins={state.mins}
          compact={false}
        />
      </div>

      {/* Victory screen */}
      {allFinished && (
        <div style={{
          marginTop: 24, padding: '28px 32px',
          background: C.ink, color: C.cream, position: 'relative', overflow: 'hidden',
          animation: 'fadeUp 0.5s ease-out',
        }}>
          <Eyebrow color={C.gold}>Round Complete</Eyebrow>

          {/* Scores + Stars */}
          {(() => {
            const score = scores[0];
            const mins = state.mins[state.players[0].school];
            return (
              <div style={{ marginTop: 16 }}>
                <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.2em', opacity: 0.7 }}>YOUR SCORE</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 8 }}>
                  <div className="font-serif" style={{
                    fontSize: 56, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1,
                  }}>{score}</div>
                </div>
                <div className="font-sans" style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                  {state.players[0].comparisons} comp · {state.players[0].swaps} swap · min {mins}
                </div>
                {score >= 100 && (
                  <div className="font-mono" style={{
                    fontSize: 10, color: C.emerald, letterSpacing: '0.15em',
                    marginTop: 4, fontWeight: 600,
                  }}>✨ PERFECT — Matched theoretical minimum!</div>
                )}
              </div>
            );
          })()}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
            <button onClick={() => dispatch({ type: 'RESET' })} style={{
              background: C.cream, color: C.ink, border: 'none',
              padding: '10px 20px', fontSize: 12, fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>
              Play Again
            </button>
            <button onClick={() => onReset(null)} style={{
              background: 'transparent', color: C.cream, border: `1px solid rgba(244,235,214,0.3)`,
              padding: '10px 20px', fontSize: 12, fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>
              Change Settings
            </button>
          </div>
        </div>
      )}

      {/* Activity log */}
      <ActivityLog log={state.log} />
    </div>
  );
};

const DemoSection = React.forwardRef(({ initialConfig, onConfigReset }, ref) => {
  return (
    <section id="play-now" ref={ref} style={{ padding: '100px 32px', background: C.dark, color: C.cream }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Eyebrow color={C.gold}>Play Now</Eyebrow>
          <SerifHeading size={54} color={C.cream}>
            Learn by <span style={{ fontStyle: 'italic' }}>doing.</span>
          </SerifHeading>
          <p className="font-serif" style={{
            fontSize: 18, color: 'rgba(244, 235, 214, 0.7)', fontStyle: 'italic',
            maxWidth: 520, margin: '20px auto 0', lineHeight: 1.5,
          }}>
            Pick an algorithm, sort the deck, beat the minimum. Tutorial mode guides you through your first round.
          </p>
        </div>

        <div style={{
          background: C.cream, color: C.ink,
          border: `1px solid ${C.rule}`, position: 'relative',
          boxShadow: '0 40px 80px rgba(0, 0, 0, 0.4)',
        }}>
          {initialConfig ? (
            <DemoPlay initial={initialConfig} onReset={onConfigReset} />
          ) : (
            <DemoSetup onStart={(sch, m, ds) => onConfigReset({ school: sch, mode: m, deckSize: ds })} />
          )}
        </div>
      </div>
    </section>
  );
});

const Footer = () => (
  <footer style={{
    background: C.dark, color: C.cream, padding: '32px 16px',
  }}>
    <div style={{
      maxWidth: 1200, margin: '0 auto',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      flexWrap: 'wrap', gap: 8,
    }}>
      <div className="font-mono" style={{
        fontSize: 10, color: 'rgba(244, 235, 214, 0.5)', letterSpacing: '0.15em',
      }}>
        © 2026 STACK ATTACK
      </div>
      <div className="font-mono" style={{
        fontSize: 10, color: 'rgba(244, 235, 214, 0.5)', letterSpacing: '0.15em',
      }}>
        DESIGNED FOR LEARNING · BUILT FOR PLAY
      </div>
    </div>
  </footer>
);

// ============================================================================
// ROOT
// ============================================================================

export default function App() {
  const [demoConfig, setDemoConfig] = useState(null);
  const demoRef = useRef(null);

  const scrollToDemo = () => {
    demoRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="grain-bg" style={{ position: 'relative', overflow: 'hidden' }}>
      <GlobalStyles />
      <Nav onPlayClick={scrollToDemo} />
      <main style={{ position: 'relative', zIndex: 1, paddingTop: 64 }}>
        <Hero onPlayClick={scrollToDemo} />
        <ProblemSection />
        <HowItWorks />
        <DemoSection
          ref={demoRef}
          initialConfig={demoConfig}
          onConfigReset={(cfg) => setDemoConfig(cfg)}
        />
      </main>
      <Footer />
    </div>
  );
}
