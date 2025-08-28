export function sumLines(lines: Array<{quantity: number; unit_amount: number; tax_rate: number;}>) {
  const sub = lines.reduce((a,l)=> a + Number(l.quantity||0)*Number(l.unit_amount||0), 0);
  const tax = lines.reduce((a,l)=> a + (Number(l.quantity||0)*Number(l.unit_amount||0))*(Number(l.tax_rate||0)/100), 0);
  const grand = sub + tax;
  return { sub_total: round2(sub), tax_total: round2(tax), grand_total: round2(grand) };
}

function round2(n: number){ 
  return Math.round((n + Number.EPSILON) * 100)/100; 
}