import lxml.etree as ET
import json
import os

ENROLLMENT_JSON = 'enrollment_data.json'
ATTENDANCE_XML = 'Attendance_data.xml'  # Ensure this matches your actual file name
OUTPUT_FILE = 'Filtered_Attendance.xml'

NAMESPACES = {
    'atom': 'http://www.w3.org/2005/Atom',
    'd': 'http://schemas.microsoft.com/ado/2007/08/dataservices',
    'm': 'http://schemas.microsoft.com/ado/2007/08/dataservices/metadata'
}

def run_sync():
    # 1. Load valid Course IDs from your filtered Enrollment JSON
    if not os.path.exists(ENROLLMENT_JSON):
        print(f"Error: {ENROLLMENT_JSON} not found. Please run the JSON converter first.")
        return
    
    print("Loading valid Course IDs from enrollment data...")
    with open(ENROLLMENT_JSON, 'r', encoding='utf-8') as f:
        enrollment_data = json.load(f)
    
    # Create a set of unique Course Codes (CrCode) for instant lookup
    valid_course_codes = {item.get('CrCode') for item in enrollment_data if item.get('CrCode')}
    print(f"Total unique courses to track: {len(valid_course_codes)}")

    # 2. Filter the Attendance XML
    if not os.path.exists(ATTENDANCE_XML):
        print(f"Error: {ATTENDANCE_XML} not found.")
        return

    print(f"Filtering {ATTENDANCE_XML}...")
    
    context = ET.iterparse(ATTENDANCE_XML, events=('end',), tag='{http://www.w3.org/2005/Atom}entry')
    
    with open(OUTPUT_FILE, 'wb') as f:
        f.write(b'<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">')
        
        total_count = 0
        kept_count = 0

        for event, elem in context:
            total_count += 1
            
            # Find the CrCode in the attendance record
            cr_code_elem = elem.find('.//d:CrCode', namespaces=NAMESPACES)
            
            if cr_code_elem is not None:
                current_cr_code = cr_code_elem.text
                
                # Compare: Is this course in our filtered faculty enrollment?
                if current_cr_code in valid_course_codes:
                    f.write(ET.tostring(elem, encoding='utf-8'))
                    kept_count += 1
            
            # Memory Management
            elem.clear()
            while elem.getprevious() is not None:
                del elem.getparent()[0]
            
            if total_count % 10000 == 0:
                print(f"Processed {total_count} attendance records... (Kept {kept_count})")

        f.write(b'</feed>')

    print(f"\nSuccess!")
    print(f"Total attendance records scanned: {total_count}")
    print(f"Attendance records kept (matching faculty courses): {kept_count}")

if __name__ == "__main__":
    run_sync()