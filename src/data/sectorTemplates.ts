export interface CustomFieldTemplate {
  label: string;
  type: 'text' | 'number' | 'textarea' | 'checkbox' | 'select' | 'checklist';
  required: boolean;
  options?: string[];
}

export interface PhotoStepTemplate {
  id: string;
  label: string;
  description?: string;
  required: boolean;
  sortOrder: number;
}

export interface WorkTypeTemplate {
  name: string;
  icon: string;
  suggestedFields: CustomFieldTemplate[];
  photoSteps?: PhotoStepTemplate[];
}

export interface IndustryTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabledModules: string[];
  workTypes: WorkTypeTemplate[];
}

// All available modules in the system
export const ALL_MODULES = [
  // Core (always enabled)
  { id: 'photo_proof', label: 'Photo Proof', description: 'GPS-tagged timestamped photo capture', core: true },
  { id: 'gps_verification', label: 'GPS Verification', description: 'Geofence-based location verification', core: true },
  { id: 'custom_fields', label: 'Custom Fields', description: 'Configurable data collection per work type', core: true },
  { id: 'alerts', label: 'Alerts', description: 'Configurable alert system', core: true },
  // Optional
  { id: 'photo_steps', label: 'Photo Steps', description: 'Guided multi-step photo workflow', core: false },
  { id: 'daily_site_log', label: 'Daily Site Log', description: 'Daily site activity logging', core: false },
  { id: 'equipment_log', label: 'Equipment Tracking', description: 'Track equipment usage and costs', core: false },
  { id: 'material_log', label: 'Material Log', description: 'Track materials, purchases, and deliveries', core: false },
  { id: 'labour_log', label: 'Labour Log', description: 'Track workers, hours, and wages', core: false },
  { id: 'expense_summary', label: 'Expense Summary', description: 'Auto-calculated cost tracking', core: false },
  { id: 'quality_inspection', label: 'Quality Inspection', description: 'Checklists and scored inspections', core: false },
  { id: 'safety_checklist', label: 'Safety Compliance', description: 'Safety checklists and incident reporting', core: false },
  { id: 'delivery_verification', label: 'Delivery Verification', description: 'Gate-in/out photo proof for deliveries', core: false },
  { id: 'task_scheduling', label: 'Task Scheduling', description: 'Recurring task assignment and tracking', core: false },
  { id: 'sla_tracking', label: 'SLA Tracking', description: 'Response and resolution time tracking', core: false },
  { id: 'complaint_tickets', label: 'Complaint Tickets', description: 'Multi-channel complaint management', core: false },
  { id: 'inventory_supplies', label: 'Inventory & Supplies', description: 'Stock tracking and reorder alerts', core: false },
  { id: 'customer_signoff', label: 'Customer Sign-off', description: 'Digital signature and OTP verification', core: false },
  { id: 'field_invoicing', label: 'Field Invoicing', description: 'On-site quote and invoice generation', core: false },
  { id: 'warranty_amc', label: 'Warranty & AMC', description: 'Warranty tracking and AMC scheduling', core: false },
  { id: 'technician_skills', label: 'Technician Management', description: 'Skill matrix and certification tracking', core: false },
  { id: 'regulatory_docs', label: 'Regulatory Documents', description: 'Permit and compliance document tracking', core: false },
  { id: 'checkpoint_patrol', label: 'Checkpoint Patrol', description: 'NFC/QR checkpoint verification', core: false },
  { id: 'incident_reporting', label: 'Incident Reporting', description: 'Severity-based incident logging', core: false },
  { id: 'visitor_management', label: 'Visitor Management', description: 'Gate check-in and visitor tracking', core: false },
  { id: 'sos_emergency', label: 'SOS Emergency', description: 'Panic button with escalation chain', core: false },
  { id: 'shift_management', label: 'Shift Management', description: '24/7 shift scheduling and handover', core: false },
  { id: 'route_tracking', label: 'Route Tracking', description: 'GPS route and stop tracking', core: false },
  { id: 'pod_management', label: 'Proof of Delivery', description: 'Photo + signature delivery proof', core: false },
  { id: 'cod_reconciliation', label: 'COD Reconciliation', description: 'Cash collection and deposit tracking', core: false },
  { id: 'ndr_management', label: 'NDR & RTO', description: 'Failed delivery and return management', core: false },
  { id: 'vehicle_inspection', label: 'Vehicle Inspection', description: 'Pre-trip vehicle condition checks', core: false },
  { id: 'client_reports', label: 'Client Reports', description: 'Auto-generated PDF/CSV reports for clients', core: false },
  { id: 'attendance', label: 'Attendance', description: 'GPS + selfie worker check-in/out', core: false },
];

export const industryTemplates: IndustryTemplate[] = [
  {
    id: 'CONSTRUCTION',
    name: 'Construction',
    icon: '🏗️',
    description: 'Building, renovation, and civil engineering projects',
    enabledModules: [
      'photo_proof', 'gps_verification', 'custom_fields', 'alerts', 'photo_steps',
      'daily_site_log', 'equipment_log', 'material_log', 'labour_log', 'expense_summary',
      'quality_inspection', 'safety_checklist', 'delivery_verification', 'attendance',
    ],
    workTypes: [
      {
        name: 'Site Inspection',
        icon: '🏗️',
        suggestedFields: [
          { label: 'Floor / Level', type: 'text', required: true },
          { label: 'Area (sqft)', type: 'number', required: false },
          { label: 'Safety Gear Worn', type: 'checkbox', required: true },
          { label: 'Work Quality', type: 'select', required: true, options: ['Good', 'Average', 'Poor'] },
        ],
      },
      {
        name: 'Concrete Pouring',
        icon: '🧱',
        suggestedFields: [
          { label: 'Floor / Level', type: 'text', required: true },
          { label: 'Volume (cum)', type: 'number', required: true },
          { label: 'Grade of Concrete', type: 'select', required: true, options: ['M15', 'M20', 'M25', 'M30', 'M35'] },
          { label: 'Curing Done', type: 'checkbox', required: true },
        ],
        photoSteps: [
          { id: 'formwork', label: 'Formwork Ready', description: 'Formwork aligned and oiled', required: true, sortOrder: 0 },
          { id: 'rebar', label: 'Rebar Placement', description: 'Steel placement before pour', required: true, sortOrder: 1 },
          { id: 'slump_test', label: 'Slump Test', description: 'Concrete slump test result', required: true, sortOrder: 2 },
          { id: 'pouring', label: 'Pouring in Progress', required: true, sortOrder: 3 },
          { id: 'vibration', label: 'Vibration', description: 'Vibrator in use', required: false, sortOrder: 4 },
          { id: 'finished', label: 'Finished Surface', required: true, sortOrder: 5 },
        ],
      },
      {
        name: 'Rebar / Steel Work',
        icon: '🔩',
        suggestedFields: [
          { label: 'Floor / Level', type: 'text', required: true },
          { label: 'Element', type: 'select', required: true, options: ['Column', 'Beam', 'Slab', 'Foundation', 'Staircase'] },
          { label: 'Bar Diameter (mm)', type: 'text', required: true },
          { label: 'Spacing Verified', type: 'checkbox', required: true },
        ],
        photoSteps: [
          { id: 'layout', label: 'Layout/Marking', required: true, sortOrder: 0 },
          { id: 'main_bars', label: 'Main Bars Placed', required: true, sortOrder: 1 },
          { id: 'stirrups', label: 'Stirrups/Ties', required: true, sortOrder: 2 },
          { id: 'cover_blocks', label: 'Cover Blocks', description: 'Cover blocks in position', required: true, sortOrder: 3 },
          { id: 'completed', label: 'Completed Cage', required: true, sortOrder: 4 },
        ],
      },
      {
        name: 'Plumbing Work',
        icon: '🔧',
        suggestedFields: [
          { label: 'Floor / Level', type: 'text', required: true },
          { label: 'Work Type', type: 'select', required: true, options: ['New Installation', 'Repair', 'Replacement'] },
          { label: 'Leak Test Passed', type: 'checkbox', required: true },
        ],
      },
      {
        name: 'Electrical Work',
        icon: '⚡',
        suggestedFields: [
          { label: 'Floor / Level', type: 'text', required: true },
          { label: 'Circuit Type', type: 'select', required: true, options: ['Wiring', 'Switch Board', 'DB Box', 'Earthing'] },
          { label: 'Safety Check Done', type: 'checkbox', required: true },
        ],
      },
      {
        name: 'Masonry Work',
        icon: '🧱',
        suggestedFields: [
          { label: 'Floor / Level', type: 'text', required: true },
          { label: 'Wall Type', type: 'select', required: true, options: ['Brick', 'Block', 'AAC Block'] },
          { label: 'Area (sqft)', type: 'number', required: false },
          { label: 'Plumb Check Done', type: 'checkbox', required: true },
        ],
      },
      {
        name: 'Material Delivery',
        icon: '🚚',
        suggestedFields: [
          { label: 'Material', type: 'text', required: true },
          { label: 'Quantity', type: 'number', required: true },
          { label: 'Unit', type: 'select', required: true, options: ['Bags', 'Kg', 'Tons', 'Cum', 'Nos', 'Sqft'] },
          { label: 'Vendor', type: 'text', required: false },
          { label: 'Challan Number', type: 'text', required: false },
        ],
        photoSteps: [
          { id: 'vehicle', label: 'Delivery Vehicle', description: 'Vehicle at gate', required: true, sortOrder: 0 },
          { id: 'challan', label: 'Delivery Challan', description: 'Photo of challan/invoice', required: true, sortOrder: 1 },
          { id: 'material', label: 'Material Unloaded', required: true, sortOrder: 2 },
          { id: 'quality', label: 'Quality Check', description: 'Close-up of material quality', required: false, sortOrder: 3 },
        ],
      },
    ],
  },
  {
    id: 'FACILITY_MANAGEMENT',
    name: 'Facility Management',
    icon: '🏢',
    description: 'Building maintenance, cleaning, and facility upkeep',
    enabledModules: [
      'photo_proof', 'gps_verification', 'custom_fields', 'alerts',
      'task_scheduling', 'quality_inspection', 'sla_tracking', 'complaint_tickets',
      'inventory_supplies', 'shift_management', 'attendance', 'client_reports',
    ],
    workTypes: [
      {
        name: 'Washroom Cleaning',
        icon: '🚽',
        suggestedFields: [
          { label: 'Floor / Block', type: 'text', required: true },
          { label: 'Checklist', type: 'checklist', required: true, options: ['Bowl Scrubbed', 'Basin Cleaned', 'Floor Mopped', 'Soap Refilled', 'Tissue Refilled', 'Mirror Cleaned', 'Dustbin Emptied'] },
        ],
        photoSteps: [
          { id: 'before', label: 'Before Cleaning', required: true, sortOrder: 0 },
          { id: 'after', label: 'After Cleaning', required: true, sortOrder: 1 },
        ],
      },
      {
        name: 'Common Area Cleaning',
        icon: '🧹',
        suggestedFields: [
          { label: 'Area', type: 'text', required: true },
          { label: 'Cleaning Type', type: 'select', required: true, options: ['Sweeping', 'Mopping', 'Deep Clean', 'Polishing'] },
          { label: 'Completed', type: 'checkbox', required: true },
        ],
      },
      {
        name: 'Equipment Maintenance',
        icon: '🔧',
        suggestedFields: [
          { label: 'Equipment ID', type: 'text', required: true },
          { label: 'Type', type: 'select', required: true, options: ['Preventive', 'Corrective', 'Emergency'] },
          { label: 'Parts Replaced', type: 'text', required: false },
          { label: 'Working After Service', type: 'checkbox', required: true },
        ],
      },
      {
        name: 'Pest Control',
        icon: '🐛',
        suggestedFields: [
          { label: 'Area Treated', type: 'text', required: true },
          { label: 'Treatment', type: 'select', required: true, options: ['Spray', 'Gel', 'Fumigation', 'Trap'] },
          { label: 'Chemical Used', type: 'text', required: false },
        ],
      },
      {
        name: 'Garden Maintenance',
        icon: '🌿',
        suggestedFields: [
          { label: 'Area', type: 'text', required: true },
          { label: 'Task', type: 'select', required: true, options: ['Watering', 'Trimming', 'Weeding', 'Planting', 'Lawn Mowing'] },
        ],
      },
    ],
  },
  {
    id: 'HOME_SERVICES',
    name: 'Home Services',
    icon: '🔧',
    description: 'AC repair, plumbing, electrical, and appliance services',
    enabledModules: [
      'photo_proof', 'gps_verification', 'custom_fields', 'alerts', 'photo_steps',
      'material_log', 'labour_log', 'customer_signoff', 'field_invoicing',
      'warranty_amc', 'technician_skills', 'inventory_supplies',
    ],
    workTypes: [
      {
        name: 'AC Service',
        icon: '❄️',
        suggestedFields: [
          { label: 'AC Type', type: 'select', required: true, options: ['Split', 'Window', 'Cassette', 'VRF'] },
          { label: 'Brand', type: 'text', required: false },
          { label: 'Model/Serial', type: 'text', required: false },
          { label: 'Service Type', type: 'select', required: true, options: ['General Service', 'Deep Clean', 'Gas Refill', 'Repair', 'Installation'] },
        ],
        photoSteps: [
          { id: 'before', label: 'Unit Before Service', required: true, sortOrder: 0 },
          { id: 'filter', label: 'Filter Condition', required: true, sortOrder: 1 },
          { id: 'work', label: 'Work in Progress', required: false, sortOrder: 2 },
          { id: 'after', label: 'Unit After Service', required: true, sortOrder: 3 },
          { id: 'testing', label: 'Temperature Reading', description: 'Cooling test after service', required: true, sortOrder: 4 },
        ],
      },
      {
        name: 'Plumbing',
        icon: '🔧',
        suggestedFields: [
          { label: 'Issue Type', type: 'select', required: true, options: ['Leak', 'Blockage', 'Installation', 'Repair', 'Replacement'] },
          { label: 'Location', type: 'text', required: true },
          { label: 'Parts Used', type: 'text', required: false },
        ],
        photoSteps: [
          { id: 'issue', label: 'Issue Photo', description: 'The problem before fix', required: true, sortOrder: 0 },
          { id: 'fixed', label: 'After Fix', required: true, sortOrder: 1 },
        ],
      },
      {
        name: 'Electrical',
        icon: '⚡',
        suggestedFields: [
          { label: 'Issue Type', type: 'select', required: true, options: ['Wiring', 'Switch/Socket', 'MCB/DB', 'Fan/Light', 'Earthing'] },
          { label: 'Safety Test Done', type: 'checkbox', required: true },
        ],
      },
      {
        name: 'Appliance Installation',
        icon: '📦',
        suggestedFields: [
          { label: 'Appliance', type: 'text', required: true },
          { label: 'Brand', type: 'text', required: false },
          { label: 'Serial Number', type: 'text', required: false },
        ],
        photoSteps: [
          { id: 'unboxing', label: 'Unboxing', required: true, sortOrder: 0 },
          { id: 'installation', label: 'Installation', required: true, sortOrder: 1 },
          { id: 'testing', label: 'Testing', required: true, sortOrder: 2 },
          { id: 'completed', label: 'Completed Setup', required: true, sortOrder: 3 },
          { id: 'customer', label: 'Customer Handoff', description: 'With customer present', required: false, sortOrder: 4 },
        ],
      },
    ],
  },
  {
    id: 'SOLAR_INSTALLATION',
    name: 'Solar / Installation',
    icon: '☀️',
    description: 'Solar panel installation and maintenance',
    enabledModules: [
      'photo_proof', 'gps_verification', 'custom_fields', 'alerts', 'photo_steps',
      'equipment_log', 'material_log', 'safety_checklist', 'quality_inspection',
      'warranty_amc', 'technician_skills', 'regulatory_docs',
    ],
    workTypes: [
      {
        name: 'Site Survey',
        icon: '📐',
        suggestedFields: [
          { label: 'Roof Type', type: 'select', required: true, options: ['RCC Flat', 'Sloped Tile', 'Metal Sheet', 'Ground Mount'] },
          { label: 'Available Area (sqft)', type: 'number', required: true },
          { label: 'Proposed Capacity (kW)', type: 'number', required: true },
          { label: 'Shading Issues', type: 'checkbox', required: true },
        ],
        photoSteps: [
          { id: 'roof_overview', label: 'Roof Overview', required: true, sortOrder: 0 },
          { id: 'roof_surface', label: 'Roof Surface Close-up', required: true, sortOrder: 1 },
          { id: 'electrical_panel', label: 'Electrical Panel', required: true, sortOrder: 2 },
          { id: 'meter_box', label: 'Meter Box', required: true, sortOrder: 3 },
          { id: 'shadow_obstacles', label: 'Shadow-casting Obstacles', required: false, sortOrder: 4 },
        ],
      },
      {
        name: 'Panel Installation',
        icon: '☀️',
        suggestedFields: [
          { label: 'Panel Brand', type: 'text', required: true },
          { label: 'Panel Wattage', type: 'number', required: true },
          { label: 'Number of Panels', type: 'number', required: true },
          { label: 'Inverter Brand', type: 'text', required: true },
        ],
        photoSteps: [
          { id: 'materials', label: 'Materials at Site', required: true, sortOrder: 0 },
          { id: 'mounting', label: 'Mounting Structure', required: true, sortOrder: 1 },
          { id: 'panels', label: 'Panels Mounted', required: true, sortOrder: 2 },
          { id: 'serial_numbers', label: 'Panel Serial Numbers', description: 'Close-up of each serial', required: true, sortOrder: 3 },
          { id: 'dc_wiring', label: 'DC Wiring', required: true, sortOrder: 4 },
          { id: 'inverter', label: 'Inverter Installed', required: true, sortOrder: 5 },
          { id: 'earthing', label: 'Earthing', required: true, sortOrder: 6 },
          { id: 'ac_side', label: 'AC Distribution Board', required: true, sortOrder: 7 },
          { id: 'meter', label: 'Net Meter', required: false, sortOrder: 8 },
          { id: 'completed', label: 'Completed System Overview', required: true, sortOrder: 9 },
        ],
      },
      {
        name: 'Commissioning',
        icon: '✅',
        suggestedFields: [
          { label: 'String Voltage (V)', type: 'number', required: true },
          { label: 'Earth Resistance (Ohm)', type: 'number', required: true },
          { label: 'Insulation Test Passed', type: 'checkbox', required: true },
          { label: 'Generation at Commissioning (kWh)', type: 'number', required: false },
        ],
      },
    ],
  },
  {
    id: 'SECURITY_PATROL',
    name: 'Security / Patrol',
    icon: '🛡️',
    description: 'Guard patrols, access control, and site security',
    enabledModules: [
      'photo_proof', 'gps_verification', 'custom_fields', 'alerts',
      'checkpoint_patrol', 'incident_reporting', 'visitor_management',
      'sos_emergency', 'shift_management', 'route_tracking', 'attendance', 'client_reports',
    ],
    workTypes: [
      {
        name: 'Patrol Round',
        icon: '🛡️',
        suggestedFields: [
          { label: 'Route Name', type: 'text', required: true },
          { label: 'Incident Found', type: 'checkbox', required: true },
          { label: 'Incident Details', type: 'textarea', required: false },
          { label: 'All Doors/Gates Locked', type: 'checkbox', required: true },
        ],
      },
      {
        name: 'Gate Duty',
        icon: '🚧',
        suggestedFields: [
          { label: 'Gate / Entry Point', type: 'text', required: true },
          { label: 'Visitor Count', type: 'number', required: false },
          { label: 'Vehicle Count', type: 'number', required: false },
          { label: 'All Clear', type: 'checkbox', required: true },
        ],
      },
      {
        name: 'Incident Report',
        icon: '🚨',
        suggestedFields: [
          { label: 'Incident Type', type: 'select', required: true, options: ['Theft', 'Trespass', 'Vandalism', 'Fire', 'Medical', 'Suspicious Activity', 'Other'] },
          { label: 'Severity', type: 'select', required: true, options: ['Critical', 'High', 'Medium', 'Low'] },
          { label: 'Description', type: 'textarea', required: true },
          { label: 'Action Taken', type: 'textarea', required: false },
        ],
      },
      {
        name: 'CCTV Check',
        icon: '📹',
        suggestedFields: [
          { label: 'Camera ID / Location', type: 'text', required: true },
          { label: 'All Cameras Working', type: 'checkbox', required: true },
          { label: 'Issues Found', type: 'textarea', required: false },
        ],
      },
    ],
  },
  {
    id: 'LOGISTICS_DELIVERY',
    name: 'Logistics / Delivery',
    icon: '🚚',
    description: 'Last-mile delivery, courier, and logistics operations',
    enabledModules: [
      'photo_proof', 'gps_verification', 'custom_fields', 'alerts',
      'route_tracking', 'pod_management', 'delivery_verification',
      'cod_reconciliation', 'ndr_management', 'vehicle_inspection',
      'attendance', 'client_reports', 'sla_tracking',
    ],
    workTypes: [
      {
        name: 'Package Delivery',
        icon: '📦',
        suggestedFields: [
          { label: 'AWB / Tracking Number', type: 'text', required: true },
          { label: 'Recipient Name', type: 'text', required: true },
          { label: 'Payment Type', type: 'select', required: true, options: ['Prepaid', 'COD'] },
          { label: 'COD Amount', type: 'number', required: false },
        ],
        photoSteps: [
          { id: 'package', label: 'Package Condition', description: 'Package before delivery', required: true, sortOrder: 0 },
          { id: 'delivered', label: 'Delivered', description: 'At doorstep or in-hand', required: true, sortOrder: 1 },
        ],
      },
      {
        name: 'Failed Delivery',
        icon: '❌',
        suggestedFields: [
          { label: 'AWB / Tracking Number', type: 'text', required: true },
          { label: 'Reason', type: 'select', required: true, options: ['Customer Unavailable', 'Wrong Address', 'Refused', 'Phone Unreachable', 'Area Inaccessible'] },
          { label: 'Attempts Made', type: 'number', required: true },
        ],
        photoSteps: [
          { id: 'location', label: 'At Location', description: 'Photo proving you were at address', required: true, sortOrder: 0 },
        ],
      },
      {
        name: 'Vehicle Inspection',
        icon: '🏍️',
        suggestedFields: [
          { label: 'Vehicle Number', type: 'text', required: true },
          { label: 'Checklist', type: 'checklist', required: true, options: ['Brakes OK', 'Tires OK', 'Lights OK', 'Horn OK', 'Mirrors OK', 'Fuel/Charge OK'] },
          { label: 'Odometer', type: 'number', required: false },
        ],
      },
    ],
  },
  {
    id: 'GENERAL',
    name: 'General',
    icon: '📋',
    description: 'Generic template — customize to your needs',
    enabledModules: [
      'photo_proof', 'gps_verification', 'custom_fields', 'alerts',
    ],
    workTypes: [
      {
        name: 'Daily Task',
        icon: '📋',
        suggestedFields: [
          { label: 'Task Description', type: 'textarea', required: false },
          { label: 'Completed', type: 'checkbox', required: true },
          { label: 'Remarks', type: 'textarea', required: false },
        ],
      },
    ],
  },
];

// Keep backward compat alias
export type SectorTemplate = IndustryTemplate;
export const sectorTemplates = industryTemplates;
