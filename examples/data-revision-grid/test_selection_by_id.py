"""Simulated grid events; separate browser validation is documented in README."""
from pathlib import Path
import json
import unittest

from test_app import GridSession

APP = Path(__file__).with_name('selection_by_id.py')


class StableSelectionTests(unittest.TestCase):
    def app(self):
        return GridSession(source=APP.read_text())

    def selected(self, app):
        grid = app.grid('queue:')
        rows = app.at.session_state[grid.key]['selection']['rows']
        return [grid.value.iloc[row]['ticket'] for row in rows]

    def test_insert_preserves_selection_and_closes_original_ticket(self):
        app = self.app().select('TICK-102')
        old_key = app.grid('queue:').key
        app.run('insert')
        self.assertNotEqual(app.grid('queue:').key, old_key)
        self.assertEqual(app.grid('queue:').value.iloc[0]['ticket'], 'TICK-100')
        self.assertEqual(self.selected(app), ['TICK-102'])
        self.assertEqual(json.loads(app.grid('queue:').proto.selection_default)
                         ['selection']['rows'], [2])
        app.run('close')
        self.assertEqual(app.at.session_state['closed'], ['TICK-102'])
        self.assertEqual(app.record('TICK-102')['status'], 'closed')
        self.assertEqual(app.record('TICK-101')['status'], 'open')

    def test_repeated_reordering_and_reselection_complete_two_closes(self):
        app = self.app().select('TICK-102').run('reverse').run('insert')
        self.assertEqual(self.selected(app), ['TICK-102'])
        app.run('close').select('TICK-103').run('reverse').run('insert')
        self.assertEqual(self.selected(app), ['TICK-103'])
        app.run('close')
        self.assertEqual(app.at.session_state['closed'], ['TICK-102', 'TICK-103'])
        self.assertEqual(app.record('TICK-102')['status'], 'closed')
        self.assertEqual(app.record('TICK-104')['note'], 'Fourth saved note')

    def test_unchanged_rerun_keeps_user_selection(self):
        app = self.app().select('TICK-102').run('insert').select('TICK-104')
        key = app.grid('queue:').key
        app.run('rerun')
        self.assertEqual(app.grid('queue:').key, key)
        self.assertEqual(self.selected(app), ['TICK-104'])
        app.run('reverse').run('close')
        self.assertEqual(app.at.session_state['closed'], ['TICK-104'])

    def test_source_value_update_preserves_selection_and_saved_content(self):
        app = self.app().select('TICK-101').run('source-update')
        self.assertEqual(app.record('TICK-101')['note'], 'Updated at source')
        self.assertEqual(self.selected(app), ['TICK-101'])
        app.run('close')
        self.assertEqual(app.at.session_state['closed'], ['TICK-101'])
        self.assertEqual(app.record('TICK-102')['note'], 'Second saved note')

    def test_filtered_selection_clears_without_restoring_on_return(self):
        app = self.app().select('TICK-102').run('filter')
        self.assertNotIn('TICK-102', app.grid('queue:').value['ticket'].tolist())
        self.assertEqual(self.selected(app), [])
        app.run('close').run('filter')
        self.assertIn('TICK-102', app.grid('queue:').value['ticket'].tolist())
        self.assertEqual(self.selected(app), [])
        self.assertEqual(app.at.session_state['closed'], [])
        app.select('TICK-102').run('close')
        self.assertEqual(app.at.session_state['closed'], ['TICK-102'])

    def test_filtering_another_record_preserves_selection(self):
        app = self.app().select('TICK-103').run('filter')
        self.assertEqual(self.selected(app), ['TICK-103'])
        app.run('close')
        self.assertEqual(app.at.session_state['closed'], ['TICK-103'])

    def test_removed_selection_empty_table_and_recovery(self):
        app = self.app()
        for ticket in ['TICK-102', 'TICK-103', 'TICK-104', 'TICK-101']:
            app.select(ticket).run('remove')
            self.assertNotIn(ticket, [r['ticket'] for r in app.at.session_state['records']])
            self.assertEqual(self.selected(app), [])
            app.run('close')
        self.assertTrue(app.grid('queue:').value.empty)
        self.assertEqual(app.at.session_state['closed'], [])
        app.run('source-update').run('insert').select('TICK-100').run('close')
        self.assertEqual(app.at.session_state['closed'], ['TICK-100'])

    def test_explicit_deselection_is_not_overridden_by_default(self):
        app = self.app().select('TICK-102').run('insert')
        grid = app.grid('queue:')
        app.values[grid.proto.id] = {'selection': {'rows': [], 'columns': [], 'cells': []}}
        app.run().run('reverse').run('close')
        self.assertEqual(self.selected(app), [])
        self.assertEqual(app.at.session_state['closed'], [])


if __name__ == '__main__':
    unittest.main()
