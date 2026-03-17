document.addEventListener('DOMContentLoaded', function() {
  // Initialize DataTables
  document.querySelectorAll('.data-table').forEach(table => {
    new DataTable(table, {
      pageLength: 25,
      responsive: true,
      order: [[0, 'asc']],
      dom: '<"row"<"col-sm-6"l><"col-sm-6"f>>rtip'
    });
  });

  // Mobile sidebar toggle
  const sidebarToggle = document.getElementById('sidebarToggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('show');
    });
  }

  // Auto-dismiss toasts
  document.querySelectorAll('.toast').forEach(el => {
    const toast = new bootstrap.Toast(el, { autohide: true, delay: 4000 });
    toast.show();
  });

  // QR modal
  document.querySelectorAll('.btn-qr').forEach(btn => {
    btn.addEventListener('click', async function() {
      const id = this.dataset.id;
      const resp = await fetch(`/assets/${id}/qr`);
      const data = await resp.json();
      document.getElementById('qrImage').src = data.qr;
      document.getElementById('qrAssetCode').textContent = data.asset.asset_code;
      document.getElementById('qrModel').textContent = `${data.asset.brand || ''} ${data.asset.model}`;
      document.getElementById('qrPrintLink').href = `/assets/${id}/qr-print`;
      new bootstrap.Modal(document.getElementById('qrModal')).show();
    });
  });

  // Select all checkboxes
  const selectAll = document.getElementById('selectAll');
  if (selectAll) {
    selectAll.addEventListener('change', function() {
      document.querySelectorAll('.asset-checkbox').forEach(cb => cb.checked = this.checked);
    });
  }
});

function getStatusBadgeClass(status) {
  const map = {
    'Active': 'badge-active',
    'Broken': 'badge-broken',
    'In Repair': 'badge-in-repair',
    'On Loan': 'badge-on-loan',
    'In Storage': 'badge-in-storage',
    'Disposed': 'badge-disposed'
  };
  return map[status] || 'bg-secondary';
}
