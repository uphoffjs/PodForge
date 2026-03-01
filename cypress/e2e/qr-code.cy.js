describe('QR Code Display', () => {
  it('displays QR code element on event page', () => {
    cy.mockEventPage()

    // QR code is behind a toggle in EventInfoBar — expand it first
    cy.getByTestId('event-info-qr-toggle').click()

    // Assert QR code container exists within the expanded section
    cy.getByTestId('event-info-qr-section').should('be.visible')
    cy.getByTestId('qr-code').should('exist')

    // Assert an SVG element exists within the QR code container
    cy.getByTestId('qr-code').find('svg').should('exist')
  })

  it('displays share link matching event URL', () => {
    cy.mockEventPage()

    // The share link input should contain the event URL with the test-uuid
    cy.getByTestId('event-info-share-link')
      .should('be.visible')
      .invoke('val')
      .should('include', '/event/test-uuid')
  })

  it('has a copy button for the share link', () => {
    cy.mockEventPage()

    cy.getByTestId('event-info-copy-btn').should('exist').should('be.visible')
  })
})
