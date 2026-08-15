import { describe, expect, it } from 'vitest';
import { validateEpttsXml } from '../../src/eptts/xml-preflight';

describe('EPTTS XML Preflight — Security & EPCIS 1.2 Validation', () => {
  it('blocks XXE external entity injections with XXE_DETECTED', () => {
    const xxePayload = `<?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
      <epcis:EPCISDocument xmlns:epcis="urn:epcglobal:epcis:xsd:1" schemaVersion="1.2" creationDate="2026-08-01T08:00:00Z">
        <EPCISBody>
          <EventList>
            <ObjectEvent>
              <action>ADD</action>
              <bizStep>urn:epcglobal:cbv:bizstep:commissioning</bizStep>
              <epcList><epc>&xxe;</epc></epcList>
            </ObjectEvent>
          </EventList>
        </EPCISBody>
      </epcis:EPCISDocument>`;

    const { result } = validateEpttsXml(xxePayload);
    expect(result.status).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'XXE_DETECTED')).toBe(true);
  });

  it('validates a bare EPCISDocument with Commissioning, Packing, and Shipping events', () => {
    const validBareXml = `<?xml version="1.0" encoding="UTF-8"?>
      <epcis:EPCISDocument xmlns:epcis="urn:epcglobal:epcis:xsd:1" xmlns:cbvmda="urn:epcglobal:cbv:mda" schemaVersion="1.2" creationDate="2026-08-01T08:00:00Z">
        <EPCISBody>
          <EventList>
            <ObjectEvent>
              <eventTime>2026-08-01T08:00:00Z</eventTime>
              <eventTimeZoneOffset>+02:00</eventTimeZoneOffset>
              <epcList>
                <epc>urn:epc:id:sgtin:0622123.456789.SN10001</epc>
              </epcList>
              <action>ADD</action>
              <bizStep>urn:epcglobal:cbv:bizstep:commissioning</bizStep>
              <disposition>urn:epcglobal:cbv:disp:active</disposition>
              <readPoint><id>urn:epc:id:sgln:6221234.56789.0</id></readPoint>
              <bizLocation><id>urn:epc:id:sgln:6221234.56789.0</id></bizLocation>
              <ilmd>
                <lotNumber>BATCH-2026-X</lotNumber>
                <itemExpirationDate>2028-12-31</itemExpirationDate>
              </ilmd>
            </ObjectEvent>
            <AggregationEvent>
              <eventTime>2026-08-01T08:30:00Z</eventTime>
              <eventTimeZoneOffset>+02:00</eventTimeZoneOffset>
              <parentID>(00)062212340000000015</parentID>
              <childEPCs>
                <epc>urn:epc:id:sgtin:0622123.456789.SN10001</epc>
              </childEPCs>
              <action>ADD</action>
              <bizStep>urn:epcglobal:cbv:bizstep:packing</bizStep>
              <readPoint><id>urn:epc:id:sgln:6221234.56789.0</id></readPoint>
              <bizLocation><id>urn:epc:id:sgln:6221234.56789.0</id></bizLocation>
            </AggregationEvent>
            <ObjectEvent>
              <eventTime>2026-08-01T09:00:00Z</eventTime>
              <eventTimeZoneOffset>+02:00</eventTimeZoneOffset>
              <epcList>
                <epc>urn:epc:id:sgtin:0622123.456789.SN10001</epc>
              </epcList>
              <action>OBSERVE</action>
              <bizStep>urn:epcglobal:cbv:bizstep:shipping</bizStep>
              <disposition>urn:epcglobal:cbv:disp:in_transit</disposition>
              <readPoint><id>urn:epc:id:sgln:6221234.56789.0</id></readPoint>
              <bizLocation><id>urn:epc:id:sgln:6221234.56789.0</id></bizLocation>
              <sourceList>
                <source type="urn:epcglobal:cbv:sdt:owning_party">6221234567891</source>
              </sourceList>
              <destinationList>
                <destination type="urn:epcglobal:cbv:sdt:owning_party">6229876543210</destination>
              </destinationList>
              <bizTransactionList>
                <bizTransaction type="urn:epcglobal:cbv:btt:po">ORD-2026-001</bizTransaction>
              </bizTransactionList>
            </ObjectEvent>
          </EventList>
        </EPCISBody>
      </epcis:EPCISDocument>`;

    const { result, canonicalEvents } = validateEpttsXml(validBareXml);
    expect(result.status).toBe('PASS');
    expect(result.errorCount).toBe(0);
    expect(result.format).toBe('XML_BARE');
    expect(result.eventCount).toBe(3);
    expect(canonicalEvents).toHaveLength(3);

    expect(canonicalEvents[0].eventType).toBe('COMMISSIONING');
    expect(canonicalEvents[0].batch).toBe('BATCH-2026-X');
    expect(canonicalEvents[0].expiryDate).toBe('2028-12-31');

    expect(canonicalEvents[1].eventType).toBe('PACKING');
    expect(canonicalEvents[1].parentEpc).toBe('(00)062212340000000015');

    expect(canonicalEvents[2].eventType).toBe('SHIPPING');
    expect(canonicalEvents[2].sourceGln).toBe('6221234567891');
    expect(canonicalEvents[2].destinationGln).toBe('6229876543210');
    expect(canonicalEvents[2].bizTransactionRef).toBe('ORD-2026-001');
  });

  it('validates a SOAP-wrapped EPCIS Document with SBDH header', () => {
    const soapXml = `<?xml version="1.0" encoding="UTF-8"?>
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sh="http://www.unece.org/cefact/namespaces/StandardBusinessDocumentHeader">
        <soapenv:Header>
          <sh:StandardBusinessDocumentHeader>
            <sh:HeaderVersion>1.0</sh:HeaderVersion>
            <sh:Sender>
              <sh:Identifier Authority="GLN">6221234567891</sh:Identifier>
            </sh:Sender>
            <sh:Receiver>
              <sh:Identifier Authority="GLN">6229876543210</sh:Identifier>
            </sh:Receiver>
            <sh:DocumentIdentification>
              <sh:Standard>EPCIS</sh:Standard>
              <sh:TypeVersion>1.2</sh:TypeVersion>
              <sh:InstanceIdentifier>DOC-2026-009</sh:InstanceIdentifier>
              <sh:Type>Events</sh:Type>
              <sh:CreationDateAndTime>2026-08-01T08:00:00Z</sh:CreationDateAndTime>
            </sh:DocumentIdentification>
          </sh:StandardBusinessDocumentHeader>
        </soapenv:Header>
        <soapenv:Body>
          <epcis:EPCISDocument xmlns:epcis="urn:epcglobal:epcis:xsd:1" schemaVersion="1.2" creationDate="2026-08-01T08:00:00Z">
            <EPCISBody>
              <EventList>
                <ObjectEvent>
                  <eventTime>2026-08-01T08:00:00Z</eventTime>
                  <epcList>
                    <epc>(01)06221234567891(21)SOAP001</epc>
                  </epcList>
                  <action>ADD</action>
                  <bizStep>commissioning</bizStep>
                  <readPoint><id>6221234567891</id></readPoint>
                  <bizLocation><id>6221234567891</id></bizLocation>
                  <ilmd>
                    <lotNumber>LOT-S1</lotNumber>
                    <itemExpirationDate>2029-01-01</itemExpirationDate>
                  </ilmd>
                </ObjectEvent>
              </EventList>
            </EPCISBody>
          </epcis:EPCISDocument>
        </soapenv:Body>
      </soapenv:Envelope>`;

    const { result, canonicalEvents } = validateEpttsXml(soapXml);
    expect(result.status).toBe('PASS');
    expect(result.format).toBe('XML_SOAP');
    expect(result.senderGln).toBe('6221234567891');
    expect(result.receiverGln).toBe('6229876543210');
    expect(result.instanceIdentifier).toBe('DOC-2026-009');
    expect(canonicalEvents).toHaveLength(1);
    expect(canonicalEvents[0].serial).toBe('SOAP001');
  });

  it('rejects shipping event missing destination GLN', () => {
    const invalidShipping = `<?xml version="1.0" encoding="UTF-8"?>
      <epcis:EPCISDocument xmlns:epcis="urn:epcglobal:epcis:xsd:1" schemaVersion="1.2">
        <EPCISBody>
          <EventList>
            <ObjectEvent>
              <eventTime>2026-08-01T09:00:00Z</eventTime>
              <epcList><epc>(01)06221234567891(21)SN01</epc></epcList>
              <action>OBSERVE</action>
              <bizStep>urn:epcglobal:cbv:bizstep:shipping</bizStep>
              <readPoint><id>6221234567891</id></readPoint>
              <bizLocation><id>6221234567891</id></bizLocation>
              <sourceList><source>6221234567891</source></sourceList>
            </ObjectEvent>
          </EventList>
        </EPCISBody>
      </epcis:EPCISDocument>`;

    const { result } = validateEpttsXml(invalidShipping);
    expect(result.status).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'XML_SHIPPING_DESTINATION_MISSING')).toBe(true);
  });
});
