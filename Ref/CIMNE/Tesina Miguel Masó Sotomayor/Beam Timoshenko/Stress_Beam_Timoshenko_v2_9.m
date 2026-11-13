function StrNod = Stress_Beam_Timoshenko_v2_9 (D_mata,D_matb,D_matab,D_mats,u)

%% Evaluates the resultant stresses at the gauss point and smooth the 
%         values to the nodes.

  global coordinates;
  global elements;
 
  nelem  = size(elements,1);           % Number of elements
  nnode  = size(elements,2);           % Number of nodes por element
  npnod  = size(coordinates,1);        % Number of nodes
  StrNod = zeros(npnod , 4 );          % Create array for stresses
  dofpn  = 3;                          % Number of DOF per node
  dofpe  = dofpn*nnode;                % Number of DOF per element
  eqnum  = zeros(dofpe);               % Equation number list

%  Element cycle.
  for ielem = 1 : nelem
    
    lnods(1:nnode) = elements(ielem,1:nnode);
 
    coor_x(1:nnode) = coordinates(lnods(1:nnode),1); % Elem. X coordinate
 
    % Finds the equation number list for the i-th element
    for i=1:nnode
      ii = (i-1)*dofpn;
      for j =1:dofpn
        eqnum(ii+j) = (lnods(i)-1)*dofpn+j; % Build the equation number list
      end
    end
    
    % Recover the nodal displacements for the i-th element
    u_elem(1:dofpe)=u(eqnum(1:dofpe));

    len = coor_x(2) - coor_x(1);  % x_j > x_i

    % One gauss point for stress evaluation
    gaus0 =  0.0;    % One Gauss point for stresses evaluation
    
    bmat_a  = [-1/len, 0, 0, 1/len, 0, 0];

    bmat_b  = [ 0, 0,-1/len, 0, 0, 1/len];

    bmat_s1 = [ 0,-1/len,-(1-gaus0)/2, 0, 1/len,-(1+gaus0)/2];

    Str1_g0 = (D_mata *bmat_a + D_matab*bmat_b)*transpose(u_elem);
    Str2_g0 = (D_matab*bmat_a + D_matb *bmat_b)*transpose(u_elem);
    Str3_g0 = (D_mats *bmat_s1)                *transpose(u_elem);

    StrNod(lnods(1),1) = StrNod(lnods(1),1)+Str1_g0;
    StrNod(lnods(2),1) = StrNod(lnods(2),1)+Str1_g0;
    StrNod(lnods(1),2) = StrNod(lnods(1),2)+Str2_g0;
    StrNod(lnods(2),2) = StrNod(lnods(2),2)+Str2_g0;
    StrNod(lnods(1),3) = StrNod(lnods(1),3)+Str3_g0;
    StrNod(lnods(2),3) = StrNod(lnods(2),3)+Str3_g0;
    StrNod(lnods(1),4) = StrNod(lnods(1),4)+1;
    StrNod(lnods(2),4) = StrNod(lnods(2),4)+1;
    
  end
  
  for i = 1 : npnod
    StrNod(i,1) = StrNod(i,1)/StrNod(i,4);
    StrNod(i,2) = StrNod(i,2)/StrNod(i,4);
    StrNod(i,3) = StrNod(i,3)/StrNod(i,4);
  end
  

