function Strnod = Stress_Beam_EulerBernoulliDD_v1_3(D_matb,u)

%% Stress Evaluates the stresses at the Gauss points and smooth the values
%         to the nodes
%
%  Parameters:
%
%    Input, D_matb : Constitutive matrix
%           u      : Nodal displacements
%   
%    Output, Strnod the nodal stress matrix (nnode,nstrs)

  global coordinates;
  global elements;
 
% Find basic dimensions
  nelem  = size(elements,1);           % Number of elements
  nnode  = size(elements,2);           % Number of nodes por element
  npnod  = size(coordinates,1);        % Number of nodes
  Strnod = zeros(npnod,2);             % Create array for stresses
  dofpn  = 2;                          % Number of DOF per node
  dofpe  = dofpn*nnode;                % Number of DOF per element
  eqnum  = zeros(dofpe);               % Equation number list

% Element cycle
  for ielem = 1 : nelem
    
    lnods(1:nnode) = elements(ielem,1:nnode);
 
    coor_x(1:nnode) = coordinates(lnods(1:nnode),1);   % Elem. X coordinate
 
% Find the equation number list for the i-th element
    for i = 1 : nnode
      ii = (i-1)*dofpn;
      for j = 1 : dofpn
        eqnum(ii+j) = (lnods(i)-1)*dofpn + j;   % Build the eq. number list
      end
    end
    
% Recover the nodal displacements for the i-th element
    u_elem(1:dofpe) = u(eqnum(1:dofpe));

    len = coor_x(2) - coor_x(1);  % x_j > x_i

% Two gauss point for stress evaluation
    gaus1 = -1/sqrt(3); % Gauss Point 1
    gaus2 =  1/sqrt(3); % Gauss Point 2
    
% Bmat and stresses at Gauss point 1 
    bmat_1 = [6*gaus1/len^2,(-1+3*gaus1)/len,-6*gaus1/len^2,(1+3*gaus1)/len];
    Str_g1 = D_matb*(bmat_1*transpose(u_elem));

% Bmat and stresses at Gauss point 2 
    bmat_2 = [6*gaus2/len^2,(-1+3*gaus2)/len,-6*gaus2/len^2,(1+3*gaus2)/len];
    Str_g2 = D_matb*(bmat_2*transpose(u_elem));
 
    Strnod(lnods(1),1) = Strnod(lnods(1),1) + Str_g1;
    Strnod(lnods(2),1) = Strnod(lnods(2),1) + Str_g2;
    Strnod(lnods(1),2) = Strnod(lnods(1),2) + 1;
    Strnod(lnods(2),2) = Strnod(lnods(2),2) + 1;
    
  end
  
  for i = 1 : npnod
    Strnod(i,1) = Strnod(i,1)/Strnod(i,2);
  end
  
