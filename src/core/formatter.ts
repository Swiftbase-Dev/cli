import chalk from "chalk";
import Table from "cli-table3";

export const formatter = {
  success: (msg: string) => console.log(chalk.green(`✔ ${msg}`)),
  error: (msg: string) => console.error(chalk.red(`✘ Error: ${msg}`)),
  info: (msg: string) => console.log(chalk.cyan(`ℹ ${msg}`)),
  warn: (msg: string) => console.log(chalk.yellow(`⚠ Warning: ${msg}`)),
  bold: (msg: string) => chalk.bold(msg),
  dim: (msg: string) => chalk.dim(msg),

  table: (head: string[], rows: any[][]) => {
    const table = new Table({
      head: head.map(h => chalk.cyan(h)),
      style: { head: [], border: [] }
    });
    rows.forEach(row => table.push(row));
    console.log(table.toString());
  }
};
