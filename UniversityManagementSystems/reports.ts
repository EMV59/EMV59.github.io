/**
 * Extension 3. Report export with the TEMPLATE METHOD pattern.
 *
 * `ReportGenerator.generate()` fixes the ORDER of steps (collect data → header → body → footer).
 * Subclasses do not change the order; they only fill in what each step looks like (XML or JSON).
 */
import type { AcademicGroup } from './learning-units.ts';
import { formatDate } from './validation.ts';

/** One line of the report. */
export interface StudentReportRow {
  readonly rank: number;
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly gradesCount: number;
  readonly gpa: number;
}

/** Everything a concrete generator needs; prepared once by the template method. */
export interface GroupReportData {
  readonly groupId: string;
  readonly groupName: string;
  readonly curator: string | null;
  readonly generatedAt: string;
  /** Average over the students that have grades (see AcademicGroup.getGroupAverageScore). */
  readonly averageScore: number;
  /** How many students the average was calculated from. */
  readonly gradedStudentCount: number;
  readonly students: readonly StudentReportRow[];
}

export abstract class ReportGenerator {
  /**
   * The template method. It is the only public method, and its steps always run in this order.
   * `generatedAt` is a parameter so that the output can be reproduced in tests.
   */
  generate(group: AcademicGroup, generatedAt: Date = new Date()): string {
    const data = this.collectData(group, generatedAt);
    return [this.generateHeader(data), this.generateBody(data), this.generateFooter(data)].join('\n');
  }

  /**
   * Common step, the same for every format: students ranked by GPA (best first, then by name).
   * Equal GPA → equal rank ("1, 1, 3" — competition ranking).
   */
  protected collectData(group: AcademicGroup, generatedAt: Date): GroupReportData {
    const rows = group
      .getStudents()
      .map((student) => ({
        id: student.id,
        fullName: student.fullName,
        email: student.email,
        gradesCount: student.getGrades().length,
        gpa: student.calculateGPA(), // calculated once per student
      }))
      .sort((a, b) => b.gpa - a.gpa || a.fullName.localeCompare(b.fullName));

    const students: StudentReportRow[] = [];
    rows.forEach((row, index) => {
      const previous = students[index - 1];
      const rank = previous !== undefined && previous.gpa === row.gpa ? previous.rank : index + 1;
      students.push({ rank, ...row });
    });

    return {
      groupId: group.id,
      groupName: group.name,
      curator: group.curator?.fullName ?? null,
      generatedAt: formatDate(generatedAt),
      averageScore: group.getGroupAverageScore(),
      gradedStudentCount: students.filter((row) => row.gradesCount > 0).length,
      students,
    };
  }

  /** Steps that every concrete format must implement. */
  protected abstract generateHeader(data: GroupReportData): string;
  protected abstract generateBody(data: GroupReportData): string;
  protected abstract generateFooter(data: GroupReportData): string;
}

/* ========================================================================== */

/** Escapes the 5 characters that are special in XML. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class XmlReportGenerator extends ReportGenerator {
  protected override generateHeader(data: GroupReportData): string {
    const curator = data.curator === null ? '' : ` curator="${escapeXml(data.curator)}"`;
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<groupReport id="${escapeXml(data.groupId)}" name="${escapeXml(data.groupName)}"${curator} generatedAt="${data.generatedAt}">`,
      '  <students>',
    ].join('\n');
  }

  protected override generateBody(data: GroupReportData): string {
    return data.students
      .map(
        (s) =>
          `    <student rank="${s.rank}" id="${escapeXml(s.id)}" grades="${s.gradesCount}" gpa="${s.gpa.toFixed(2)}">` +
          `<name>${escapeXml(s.fullName)}</name><email>${escapeXml(s.email)}</email></student>`,
      )
      .join('\n');
  }

  protected override generateFooter(data: GroupReportData): string {
    return [
      '  </students>',
      `  <summary studentCount="${data.students.length}" gradedStudentCount="${data.gradedStudentCount}" averageScore="${data.averageScore.toFixed(2)}"/>`,
      '</groupReport>',
    ].join('\n');
  }
}

export class JsonReportGenerator extends ReportGenerator {
  /** The three parts together form ONE valid JSON document (checked by the tests with JSON.parse). */
  protected override generateHeader(data: GroupReportData): string {
    const meta = {
      groupId: data.groupId,
      groupName: data.groupName,
      curator: data.curator,
      generatedAt: data.generatedAt,
    };
    return `{\n  "report": ${JSON.stringify(meta)},\n  "students": [`;
  }

  protected override generateBody(data: GroupReportData): string {
    return data.students.map((row) => `    ${JSON.stringify(row)}`).join(',\n');
  }

  protected override generateFooter(data: GroupReportData): string {
    // Numbers stay numbers in JSON (95, not "95.00"); formatting to 2 decimals is a display concern of XML.
    const summary = {
      studentCount: data.students.length,
      gradedStudentCount: data.gradedStudentCount,
      averageScore: data.averageScore,
    };
    return `  ],\n  "summary": ${JSON.stringify(summary)}\n}`;
  }
}
