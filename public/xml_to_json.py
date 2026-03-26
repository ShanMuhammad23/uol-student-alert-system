import lxml.etree as ET
import json
import os

# Always work relative to this script's directory (i.e. /public)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(BASE_DIR, 'Filtered_Attendance.xml')
OUTPUT_FILE = os.path.join(BASE_DIR, 'attendance_data.json')

# Namespaces found in your SAP XML
NAMESPACES = {
    'atom': 'http://www.w3.org/2005/Atom',
    'd': 'http://schemas.microsoft.com/ado/2007/08/dataservices',
    'm': 'http://schemas.microsoft.com/ado/2007/08/dataservices/metadata'
}

def convert_to_json():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found.")
        return

    print(f"Converting {INPUT_FILE} to JSON...")
    
    # We use iterparse again for efficiency
    context = ET.iterparse(INPUT_FILE, events=('end',), tag='{http://www.w3.org/2005/Atom}entry')
    
    student_list = []

    for event, elem in context:
        # Locate the properties container
        properties = elem.find('.//m:properties', namespaces=NAMESPACES)
        
        if properties is not None:
            student_data = {}
            # Loop through every child in <m:properties> (the <d:Field> tags)
            for field in properties:
                # Strip the namespace prefix (e.g., '{...}Name' becomes 'Name')
                tag_name = field.tag.split('}')[-1]
                student_data[tag_name] = field.text
            
            student_list.append(student_data)
        
        # Clean up memory
        elem.clear()
        while elem.getprevious() is not None:
            del elem.getparent()[0]

    # Save to JSON file with indentation for readability
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(student_list, f, indent=4)

    print(f"Success! Created {OUTPUT_FILE} with {len(student_list)} records.")

if __name__ == "__main__":
    convert_to_json()