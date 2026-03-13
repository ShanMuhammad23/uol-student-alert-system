import lxml.etree as ET
import os
INPUT_FILE = 'Enrollment_data.xml'
OUTPUT_FILE = 'Filtered_Enrollment_data.xml'
TARGET_FAC_ID = '50000172'

NAMESPACES = {
    'atom': 'http://www.w3.org/2005/Atom',
    'd': 'http://schemas.microsoft.com/ado/2007/08/dataservices',
    'm': 'http://schemas.microsoft.com/ado/2007/08/dataservices/metadata'
}

def run_filter():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found in this folder.")
        return

    print("Starting processing... this may take a few minutes for 500k rows.")
    context = ET.iterparse(INPUT_FILE, events=('end',), tag='{http://www.w3.org/2005/Atom}entry')
    
    with open(OUTPUT_FILE, 'wb') as f:
        # Write a standard XML header and root
        f.write(b'<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">')
        
        count = 0
        kept = 0
        
        for event, elem in context:
            count += 1
          
            fac_id = elem.find('.//d:FacId', namespaces=NAMESPACES)
            
            if fac_id is not None and fac_id.text == TARGET_FAC_ID:
                # Write this entry to the new file
                f.write(ET.tostring(elem, encoding='utf-8'))
                kept += 1
            
            elem.clear()
            while elem.getprevious() is not None:
                del elem.getparent()[0]
            
            if count % 10000 == 0:
                print(f"Checked {count} entries... (Found {kept} matches)")

        f.write(b'</feed>')
        
    print(f"\nFinished!")
    print(f"Total entries scanned: {count}")
    print(f"Total entries kept: {kept}")
    print(f"Result saved to: {OUTPUT_FILE}")

if __name__ == "__main__":
    run_filter()