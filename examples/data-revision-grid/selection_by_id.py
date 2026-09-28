"""Preserve a selected ticket through explicit changes to the served snapshot."""
import pandas as pd
import streamlit as st

st.set_page_config(page_title='Ticket selection', layout='centered')
st.session_state.setdefault('records', [
    {'ticket': f'TICK-{101 + i}', 'note': note, 'status': 'open'}
    for i, note in enumerate(['First saved note', 'Second saved note',
                              'Third saved note', 'Fourth saved note'])
])
st.session_state.setdefault('revision', 0)
st.session_state.setdefault('next_ticket', 100)
st.session_state.setdefault('selected_ticket', None)
st.session_state.setdefault('hide_102', False)
st.session_state.setdefault('closed', [])
st.session_state.setdefault('message', 'Choose a ticket, then refresh or close it.')


def refresh(message):
    # Call after every source or view change, including same-length reorders.
    st.session_state['revision'] += 1
    st.session_state['message'] = message
    st.rerun()


st.title('Ticket selection')
st.info('Refreshes keep the selected ticket while it remains in the table. '
        'Removing or hiding that ticket clears the selection.')
st.write(st.session_state['message'])

snapshot = pd.DataFrame([
    row for row in st.session_state['records']
    if not (st.session_state['hide_102'] and row['ticket'] == 'TICK-102')
], columns=['ticket', 'note', 'status'])
ids = snapshot['ticket'].tolist()  # Unique, non-null, immutable IDs from the source.
selected = st.session_state['selected_ticket']
default_rows = [ids.index(selected)] if selected in ids else []
event = st.dataframe(
    snapshot,
    key=f"queue:{st.session_state['revision']}",
    on_select='rerun', selection_mode='single-row', hide_index=True, lazy=False,
    selection_default={'selection': {'rows': default_rows}},
)
# Resolve the current event against this exact snapshot, before any mutation.
# The default seeds a NEW key; it does not override later user selections.
selected = ids[event.selection.rows[0]] if event.selection.rows else None
st.session_state['selected_ticket'] = selected
st.write('Selected ticket:', selected or 'None')

left, right = st.columns(2)
if left.button('Insert a new ticket', key='insert'):
    number = st.session_state['next_ticket']
    st.session_state['next_ticket'] -= 1
    new_row = {'ticket': f'TICK-{number}', 'note': 'New ticket', 'status': 'open'}
    st.session_state['records'] = [new_row, *st.session_state['records']]
    refresh('New ticket loaded.')
if right.button('Reverse row order', key='reverse'):
    st.session_state['records'] = list(reversed(st.session_state['records']))
    refresh('Row order refreshed.')
if left.button('Hide/show TICK-102', key='filter'):
    st.session_state['hide_102'] = not st.session_state['hide_102']
    refresh('Ticket filter changed.')
if right.button('Update TICK-101 at source', key='source-update'):
    if any(row['ticket'] == 'TICK-101' for row in st.session_state['records']):
        st.session_state['records'] = [
            {**row, 'note': 'Updated at source'} if row['ticket'] == 'TICK-101' else row
            for row in st.session_state['records']
        ]
        refresh('TICK-101 was updated at the source.')
    else:
        st.info('TICK-101 is no longer in the source.')
if left.button('Close selected', key='close'):
    if selected is None:
        st.info('Select a ticket first.')
    else:
        st.session_state['records'] = [
            {**row, 'status': 'closed'} if row['ticket'] == selected else row
            for row in st.session_state['records']
        ]
        if selected not in st.session_state['closed']:
            st.session_state['closed'].append(selected)
        refresh(f'Closed {selected}.')
if right.button('Remove selected from source', key='remove'):
    if selected is None:
        st.info('Select a ticket first.')
    else:
        st.session_state['records'] = [
            row for row in st.session_state['records'] if row['ticket'] != selected
        ]
        refresh(f'Removed {selected}.')
st.button('Rerun without data changes', key='rerun')
st.write('Closed tickets:', st.session_state['closed'])
st.caption('Synthetic tickets in this browser session only. No database writes.')
