function Strnod = Stress_Rev_Shell_v1_1(D_matb,D_mats,D_matm,u)

%% Stress Evaluates the stresses at the Gauss points and smooth the values
%         to the nodes
%
%  Parameters:
%
%    Input, D_matb  : Constitutive matrix for bending moment
%           D_mats  : Constitutive matrix for shear force
%           D_matm  : Constitutive matrix for membrane forces
%           u       : Nodal displacements
%   
%    Output, Strnod the nodal stress matrix (nnode,nstrs)

  global coordinates;
  global elements;

% Find basic dimensions
  npnod  = size(coordinates,1);        % Number of nodes
  nelem  = size(elements,1);           % Number of elements
  nnode  = size(elements,2);           % Number of elements
  eqnum  = size(15);
  Strnod = zeros(npnod,6);             % Nodal Stresses

% Dimension the global matrices
  Mx = zeros( nelem , 1 );      % Create array for streses
  Mf = zeros( nelem , 1 );      % Create array for streses
  Qz = zeros( nelem , 1 );      % Create array for streses
  Nx = zeros( nelem , 1 );      % Create array for streses
  Nf = zeros( nelem , 1 );      % Create array for streses

% Element cycle
  for ielem = 1 : nelem
       
    lnods(1:nnode) = elements(ielem,1:nnode);
  
    cxy(1:nnode,:) = coordinates(lnods(1:nnode),:);   % Element coordinates

    Te = Rotation_system_RS_v1_1(cxy);

% Find the equation number list for the i-th element
    for i = 1 : 2
      ii = (i-1)*3;
      eqnum(ii+1) = (lnods(i)-1)*3 + 1;    % Build the equation number list
      eqnum(ii+2) = (lnods(i)-1)*3 + 2;
      eqnum(ii+3) = (lnods(i)-1)*3 + 3;
    end
%     
    u_elem = u(eqnum);
    
    [bmat_b,bmat_s,bmat_m,len] = B_mat_Rev_Shell_v1_1(cxy,Te); 
 
    Str1 = D_matb*bmat_b*u_elem;
    Str2 = D_mats*bmat_s*u_elem;
    Str3 = D_matm*bmat_m*u_elem;
% 
    Mx(ielem) = Str1(1);
    Mf(ielem) = Str1(2);
    Qz(ielem) = Str2(1);
    Nx(ielem) = Str3(1);
    Nf(ielem) = Str3(2);

  end
%
% Smoothing of Shear Nodal Stresses 
%
  for ielem = 1 : nelem
  
    lnods = elements(ielem,:);
  
    for inod = 1 : 2
      Strnod(lnods(inod),1) = Strnod(lnods(inod),1) + Mx(ielem);
      Strnod(lnods(inod),2) = Strnod(lnods(inod),2) + Mf(ielem);
      Strnod(lnods(inod),3) = Strnod(lnods(inod),3) + Qz(ielem);
      Strnod(lnods(inod),4) = Strnod(lnods(inod),4) + Nx(ielem);
      Strnod(lnods(inod),5) = Strnod(lnods(inod),5) + Nf(ielem);
      Strnod(lnods(inod),6) = Strnod(lnods(inod),6) + 1;
    end
  end
   
  for i = 1 : npnod
    Strnod(i,1:5) = Strnod(i,1:5)/Strnod(i,6);
  end

