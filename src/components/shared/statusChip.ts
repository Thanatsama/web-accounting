import { SxProps, Theme } from '@mui/material/styles';
import { RowStatus } from '@/lib/budgetState';

export function getStatusChipSx(status: RowStatus): SxProps<Theme> {
  if (status === 'PAID') {
    return {
      height: 28,
      borderRadius: '999px',
      border: '1px solid #8fd3a8',
      background: 'linear-gradient(135deg, #dff6e7 0%, #bfeccf 100%)',
      color: '#1d7a43',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
      '& .MuiChip-label': {
        px: 1.25,
        fontWeight: 700,
        letterSpacing: '0.02em',
      },
    };
  }

  return {
    height: 28,
    borderRadius: '999px',
    border: '1px solid #f3bf82',
    background: 'linear-gradient(135deg, #ffead0 0%, #ffc980 100%)',
    color: '#9a5308',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
    '& .MuiChip-label': {
      px: 1.25,
      fontWeight: 700,
      letterSpacing: '0.02em',
    },
  };
}
