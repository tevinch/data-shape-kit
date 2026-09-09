"""Local example: keep pasted values as text, then validate explicit separators."""

# Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT

import streamlit as st

from decimal_text import parse_decimal_text


st.set_page_config(page_title='Decimal paste example', layout='centered')
st.title('Keep decimal commas intact')
st.write('Paste spreadsheet values into the text column, choose their number format, '
         'then convert. The original input stays visible.')

decimal_mark = st.selectbox(
    'Decimal mark', [',', '.'], format_func=lambda mark: 'Comma (,)' if mark == ',' else 'Dot (.)'
)
group_labels = {None: 'None', '.': 'Dot (.)', ',': 'Comma (,)', ' ': 'Space',
                '\u00a0': 'Non-breaking space (U+00A0)', '\u202f': 'Narrow non-breaking space (U+202F)'}
group_options = [None, '.' if decimal_mark == ',' else ',', ' ', '\u00a0', '\u202f']
group_mark = st.selectbox('Grouping mark', group_options,
                          format_func=lambda mark: group_labels[mark],
                          help='Use None unless the source values actually contain grouping separators.')

edited = st.data_editor(
    {'Raw value': ['23,4', '0012,00']},
    column_config={'Raw value': st.column_config.TextColumn('Raw value', max_chars=256)},
    num_rows='dynamic', hide_index=True, key='raw_values',
)
st.caption('This is a text input path. It cannot recover punctuation or digits already changed '
           'by an earlier numeric conversion.')

if st.button('Convert values', type='primary'):
    results = []
    counts = {'valid': 0, 'invalid': 0, 'empty': 0}
    for row_number, raw in enumerate(edited['Raw value'], start=1):
        result = {'row': row_number, 'raw': raw, 'decimal': None}
        if raw is None or (isinstance(raw, str) and not raw.strip(' \u00a0\u202f')):
            result['status'] = 'empty'
        else:
            try:
                value = parse_decimal_text(raw, decimal_mark=decimal_mark, group_mark=group_mark)
                result.update(decimal=format(value, 'f'), status='valid')
            except (TypeError, ValueError) as error:
                result.update(status='invalid', error=str(error))
        counts[result['status']] += 1
        results.append(result)
    st.subheader('Conversion report')
    st.write(f"{counts['valid']} valid · {counts['invalid']} invalid · {counts['empty']} empty")
    st.caption('Decimal results are shown as strings to retain every digit and trailing decimal zero. '
               'The Python helper returns Decimal objects for your code to use.')
    st.json(results, expanded=True)

st.divider()
st.markdown('**Buy me a coffee, if this helped**')
st.write("If this saved you a little time, you're welcome to buy me a coffee. Please don't feel "
         'obliged — feedback or sharing the example is appreciated too.')
st.markdown('- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`\n'
            '- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`\n'
            '- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`')
st.caption('Please match the asset and network exactly. Fees depend on your wallet or exchange. '
           'Thank you! — Tevinch')
