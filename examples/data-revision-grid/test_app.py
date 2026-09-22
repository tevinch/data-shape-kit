"""Backend workflow tests. Grid payloads are simulated, not browser interaction.

Streamlit 1.64.0 AppTest does not expose a grid-selection/editor setter. This
small test adapter supplies WidgetStates to its private runner; keep the pinned
version when running these tests. The application uses only public APIs.
"""
import json
from pathlib import Path
import unittest

from streamlit.testing.v1 import AppTest


class GridSession:
    def __init__(self, source=None):
        self.at = (AppTest.from_string(source) if source else
                   AppTest.from_file(Path(__file__).with_name('app.py'))).run()
        self.values = {}
        self.check()

    def check(self):
        if self.at.exception:
            raise AssertionError([error.value for error in self.at.exception])

    def grid(self, prefix):
        return next(item for item in self.at.dataframe if item.key.startswith(prefix))

    def select(self, ticket):
        grid = self.grid('queue:')
        position = grid.value['ticket'].tolist().index(ticket)
        self.values[grid.proto.id] = {'selection': {'rows': [position], 'columns': [], 'cells': []}}
        return self.run()

    def edit(self, ticket, note):
        grid = self.grid('notes:')
        position = grid.value['ticket'].tolist().index(ticket)
        self.values[grid.proto.id] = {'edited_rows': {str(position): {'note': note}},
                                    'added_rows': [], 'deleted_rows': []}
        return self.run()

    def run(self, button=None):
        if button:
            self.at.button(key=button).click()
        states = self.at._tree.get_widget_states()
        for grid in self.at.dataframe:
            if grid.proto.id in self.values:
                states.widgets.add(id=grid.proto.id, string_value=json.dumps(self.values[grid.proto.id]))
        self.at._run(states)
        self.check()
        current = {grid.proto.id for grid in self.at.dataframe}
        self.values = {key: value for key, value in self.values.items() if key in current}
        return self

    def record(self, ticket):
        return next(row for row in self.at.session_state['records'] if row['ticket'] == ticket)


class WorkflowTests(unittest.TestCase):
    def test_insert_clears_selection_then_reselection_closes_correct_ticket(self):
        app = GridSession().select('TICK-102').run('insert').run('close')
        self.assertEqual(app.at.session_state['closed'], [])
        app.select('TICK-102').run('close')
        self.assertEqual(app.at.session_state['closed'], ['TICK-102'])
        self.assertEqual(app.record('TICK-102')['status'], 'closed')
        self.assertEqual(app.record('TICK-101')['status'], 'open')

    def test_repeated_reordering_requires_a_fresh_selection(self):
        app = GridSession().select('TICK-102').run('reverse').run('close')
        self.assertEqual(app.at.session_state['closed'], [])
        app.select('TICK-102').run('insert').run('close')
        self.assertEqual(app.at.session_state['closed'], [])
        app.select('TICK-102').run('close')
        self.assertEqual(app.at.session_state['closed'], ['TICK-102'])

    def test_unchanged_rerun_preserves_selection_and_draft(self):
        app = GridSession().select('TICK-102').edit('TICK-102', 'Ready for review')
        app.run('rerun').run('save')
        self.assertEqual(app.record('TICK-102')['note'], 'Ready for review')
        app.select('TICK-103').run('rerun').run('close')
        self.assertEqual(app.at.session_state['closed'], ['TICK-103'])

    def test_same_length_reorder_discards_draft_then_save_targets_correct_ticket(self):
        app = GridSession().edit('TICK-102', 'Stale note').run('reverse').run('save')
        self.assertEqual(app.record('TICK-102')['note'], 'Second saved note')
        self.assertFalse(any(row['note'] == 'Stale note' for row in app.at.session_state['records']))
        app.edit('TICK-102', 'Reviewed').run('save').run('insert').run('reverse')
        self.assertEqual(app.record('TICK-102')['note'], 'Reviewed')
        self.assertEqual(app.record('TICK-101')['note'], 'First saved note')
        self.assertEqual(app.record('TICK-104')['note'], 'Fourth saved note')

    def test_source_value_update_also_discards_stale_draft(self):
        app = GridSession().edit('TICK-102', 'Old draft').select('TICK-103')
        app.run('source-update').run('save').run('close')
        self.assertEqual(app.record('TICK-101')['note'], 'Updated at source')
        self.assertEqual(app.record('TICK-102')['note'], 'Second saved note')
        self.assertEqual(app.at.session_state['closed'], [])
        app.edit('TICK-102', 'Current draft').run('save')
        self.assertEqual(app.record('TICK-102')['note'], 'Current draft')

    def test_editor_configuration_and_existing_content(self):
        app = GridSession()
        editor = app.grid('notes:').proto
        columns = json.loads(editor.columns)
        self.assertTrue(columns['ticket']['disabled'])
        self.assertTrue(columns['status']['disabled'])
        self.assertTrue(columns['_index']['hidden'])
        self.assertEqual(editor.editing_mode, editor.FIXED)
        self.assertEqual(app.record('TICK-102')['note'], 'Second saved note')


if __name__ == '__main__':
    unittest.main()
