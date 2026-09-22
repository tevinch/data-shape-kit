"""An in-memory ticket queue with table state scoped to a data revision."""
import pandas as pd
import streamlit as st

st.set_page_config(page_title='Ticket queue', layout='centered')
st.session_state.setdefault('records', [
    {'ticket': f'TICK-{101 + i}', 'note': note, 'status': 'open'}
    for i, note in enumerate(['First saved note', 'Second saved note',
                              'Third saved note', 'Fourth saved note'])
])
st.session_state.setdefault('revision', 0)
st.session_state.setdefault('next_ticket', 100)
st.session_state.setdefault('closed', [])
st.session_state.setdefault('message', 'Choose a ticket or edit a note below.')


def replace_snapshot(records, message):
    # Every source change must replace the data and advance its revision together.
    st.session_state['records'] = records
    st.session_state['revision'] += 1
    st.session_state['message'] = message


def insert_ticket():
    number = st.session_state['next_ticket']
    st.session_state['next_ticket'] -= 1
    new_row = {'ticket': f'TICK-{number}', 'note': 'New ticket', 'status': 'open'}
    replace_snapshot([new_row, *st.session_state['records']], 'New ticket loaded. Select again before closing.')


def reverse_rows():
    replace_snapshot(list(reversed(st.session_state['records'])), 'Order refreshed. Select again before closing.')


def update_at_source():
    records = [dict(row) for row in st.session_state['records']]
    next(row for row in records if row['ticket'] == 'TICK-101')['note'] = 'Updated at source'
    replace_snapshot(records, 'TICK-101 was updated at the source.')


st.title('Ticket queue')
st.info('Loading, closing, or saving tickets clears selections and unsaved notes. Saved notes stay.')
left, right = st.columns(2)
left.button('Insert a new ticket', key='insert', on_click=insert_ticket)
right.button('Reverse row order', key='reverse', on_click=reverse_rows)
left.button('Update TICK-101 at source', key='source-update', on_click=update_at_source)
right.button('Rerun without data changes', key='rerun')
st.write(st.session_state['message'])

# Capture one snapshot for both rendering and interpreting returned positions.
snapshot = pd.DataFrame(st.session_state['records'])
revision = st.session_state['revision']
selection = st.dataframe(snapshot, key=f'queue:{revision}', on_select='rerun',
                         selection_mode='single-row', hide_index=True)
if st.button('Close selected', key='close'):
    if selection.selection.rows:
        ticket = snapshot.iloc[selection.selection.rows[0]]['ticket']
        records = [dict(row) for row in st.session_state['records']]
        next(row for row in records if row['ticket'] == ticket)['status'] = 'closed'
        if ticket not in st.session_state['closed']:
            st.session_state['closed'].append(ticket)
        replace_snapshot(records, f'Closed {ticket}.')
        st.rerun()
    else:
        st.info('Select a ticket from the current table first.')
st.write('Closed tickets:', st.session_state['closed'])

st.subheader('Edit notes')
edited = st.data_editor(snapshot, key=f'notes:{revision}', num_rows='fixed',
                        hide_index=True, disabled=['ticket', 'status'])
if st.button('Save notes', key='save'):
    # In this local example only notes are editable. Map them using the IDs from
    # the served snapshot; positions alone never identify stored records.
    notes = dict(zip(snapshot['ticket'], edited['note'], strict=True))
    records = [{**row, 'note': notes[row['ticket']]} for row in st.session_state['records']]
    if records != st.session_state['records']:
        replace_snapshot(records, 'Notes saved.')
        st.rerun()
    else:
        st.info('No note changes to save.')
st.caption('This demo stores synthetic tickets in this browser session only.')
