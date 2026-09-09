"use client";
// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import MarkdownTableGenerator from './markdown-table-generator';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const controls = { Button, Panel, Select, Textarea };

export default function DevKitMarkdownTable() {
  return <MarkdownTableGenerator controls={controls} />;
}
